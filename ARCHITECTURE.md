# Architecture

Flame Intelligence is one application with one paper identifier flowing from NASA discovery to the screen. The interaction model is an **evidence bench**, not a chat product with a chart page beside it.

This document is a plan. The modules below are not built yet.

## Why this shape

Most hackathon entries will be a search box, a language-model answer, and a bar chart. Flame Intelligence is built so the memorable path is verification:

1. A person opens a real NASA record from the **Source Stack**.
2. They ask a question and receive a **Claim Docket**: separate reported findings, labeled interpretations, and an explicit insufficient-evidence result when the corpus is silent.
3. A citation opens the **Passage Lens** on the extracted page, with the official source URL.
4. Choosing two experiments hits the **Comparability Gate**. A chart renders only when the gate returns `comparable` or `comparable_with_caveat`. Otherwise the screen shows a **Divergence Card**: which conditions differ and which fields were not reported.
5. **The Unsaid** stays visible: limitations the corpus does not establish, including lunar or Martian gravity and any claim of certified spacecraft fire safety.

Retrieval is the product. The language model is optional narration on top of passages the system already retrieved. If no model is configured, the bench still returns passages, page numbers, and source links, and it refuses to invent a prose answer.

## System flow

```
NASA NTRS / NASA PSI
        │
        ▼
Ingestion and metadata manifest          Agent 2
        │
        ▼
Page-aware extraction (original page numbers kept)
        │
        ├──────────────────────────────┐
        ▼                              ▼
Chunk index + evidence gate      Verified study table
RAG claim docket                 Comparability gate
Agent 1                          Agent 3
        │                              │
        └──────────────┬───────────────┘
                       ▼
              FastAPI services          Agent 5
                       │
                       ▼
              Evidence Bench UI         Agent 4
              Source Stack
              Claim Docket
              Passage Lens
              Comparability Gate
              The Unsaid
                       │
                       ▼
              Journey tests and audits  Agent 6
```

## Runtime processes

Two local processes are enough.

| Process | Stack | Responsibility |
| --- | --- | --- |
| `backend` | Python, FastAPI, Pydantic | Manifest, extraction artifacts, retrieval, evidence gate, comparison gate, citations |
| `frontend` | Next.js, TypeScript, Tailwind CSS | Evidence bench. Charts via Recharts only after the gate allows them |

Storage for the prototype:

- JSON for the manifest, page text, chunks, and verified studies
- Local files for original PDFs (gitignored)
- FAISS on disk if sentence-transformer embeddings are available
- Keyword / SQLite FTS5 index as the retrieval path that must work without extra services

No hosted vector database. No paid infrastructure. Credentials live in environment variables and are never committed.

## Modules

### 1. Research sources

Official records only, discovered from NTRS and PSI. Each accepted record stores the official URL, the native identifier, and whether a PDF was actually downloaded. A record without a reachable official URL is not added.

### 2. Ingestion and metadata

Reproducible scripts search focused topics: flame spread, flame extinction, solid or liquid fuel combustion, microgravity flame behavior, oxygen concentration, spacecraft fire safety. Target corpus size is 10–20 relevant records. Five verified records beat twenty poorly extracted ones.

### 3. Page-aware extraction

PyMuPDF is the default extractor. pdfplumber is the fallback for tables that PyMuPDF flattens badly. Every page keeps `paper_id` and the PDF page number. Headers and footers may be removed only when the removal rule is recorded. Scanned pages are flagged, not silently OCR'd into the demo corpus unless a human checks them.

### 4. Shared research storage

See [DATA_SCHEMA.md](DATA_SCHEMA.md). One `paper_id` is used by the manifest, pages, chunks, studies, citations, API, and UI.

### 5. RAG and the evidence gate

Pipeline for `POST /api/ask`:

1. Retrieve candidate chunks (embeddings if the local model is installed, otherwise keyword search).
2. Run the **evidence gate** in code, before any language model call.
   - No chunk, or only weak lexical overlap with the question: return `grade: insufficient`. Do not call the model.
   - Usable chunks: pass only those chunks to the model, with identifiers.
3. The model must return structured claims. Each reported claim names a `chunk_id` from the supplied set.
4. The **citation auditor** drops any claim whose `chunk_id` was not retrieved for that request. If nothing remains, the response becomes insufficient evidence.
5. Interpretations are a separate list and cannot carry a measurement that is absent from the chunks.

The model is selected by environment:

- `LLM_PROVIDER=ollama` and `OLLAMA_MODEL` when a local Ollama server is running
- `LLM_PROVIDER=openai_compatible` with `LLM_BASE_URL` and `LLM_API_KEY` for any compatible hosted endpoint
- unset provider: retrieval still runs; `answer_mode` is `passages_only`

### 6. Scientific analysis

Studies and measurements are entered only from a human-checked page, table, or figure. The comparison gate is deterministic. It does not ask a language model whether two numbers “look similar.”

A pair is `comparable` only when all of the following hold:

- the measurement family and the measurement definition match
- units are identical, or a documented conversion exists and the original value is retained
- gravity regime matches
- fuel family matches
- both values are `verification_status: verified`

`comparable_with_caveat` is allowed when the above hold and oxygen or pressure differs but both are reported. The caveat is shown on the chart. `not_comparable` blocks the chart and returns the divergence card. Missing fields are `not_reported`, never zero.

### 7. HTTP services

FastAPI loads the JSON artifacts, validates them with the shared Pydantic models, and exposes the contracts in [API_CONTRACTS.md](API_CONTRACTS.md). The frontend never re-implements comparability.

### 8. Evidence bench

Routes:

| Route | Instrument |
| --- | --- |
| `/` | Bench home: corpus statistics from `GET /api/stats`, entry to the other instruments, The Unsaid |
| `/research` | Source Stack: filter official records, open a record |
| `/research/[paperId]` | Record metadata, access status, link to the official source |
| `/ask` | Claim Docket bound to the current corpus |
| `/evidence/[chunkId]` | Passage Lens |
| `/compare` | Study picker, gate result, table, chart only if allowed |

The visual system is a laboratory bench: paper-dark ground, one ember accent, serif titles for real paper titles, monospace for `paper_id` and page numbers. It is not a purple marketing dashboard. Motion is limited to loading and gate-state changes.

Empty, error, and slow states are part of the layout. Statistics count only records present in the manifest.

### 9. Validation

Agent 6 owns a written test set of at least 15 questions (factual, comparison, and unanswerable), citation audits, measurement audits, and one scripted journey from dashboard to evidence. A feature is not done because a button exists.

## Boundaries

- NASA authors the findings. The application stores and retrieves them.
- The UI label is “research discovery prototype.” It does not say NASA endorses the tool.
- Microgravity results are not presented as lunar, Martian, or operational fire-safety predictions.
- User notes, if added later, are a separate store and cannot overwrite a NASA field.
- Placeholder UI copy is allowed. Placeholder measurements are not, even if labeled, until a demo path truly has no verified pair. In that case the demo is the non-comparable divergence card, which is a valid success state in the team report.

## Repository layout to create after approval

```
flame-intelligence/
  ARCHITECTURE.md
  REQUIREMENTS.md
  DATA_SCHEMA.md
  API_CONTRACTS.md
  AGENT_ROLES.md
  TASKS.md
  README.md
  .env.example
  backend/
    pyproject.toml
    app/
      main.py
      config.py
      schemas/          # Agent 5, matches DATA_SCHEMA.md
      routes/           # Agent 5
      services/
        ingestion/      # Agent 2
        rag/            # Agent 1
        comparison/     # Agent 3
      storage/
    tests/
      test_rag.py
      test_comparison.py
      test_api.py
      test_journey.py
    data/
      manifest.json
      extracts/
      chunks.json
      studies.json
      data_dictionary.md
  frontend/
    package.json
    app/
    components/
      SourceStack.tsx
      ClaimDocket.tsx
      PassageLens.tsx
      ComparabilityGate.tsx
      UnsaidStrip.tsx
    lib/api.ts
  qa/
    TEST_PLAN.md
    ISSUE_TRACKER.md
    questions.json
    CITATION_AUDIT.md
```

Agents do not edit files outside their ownership list in [AGENT_ROLES.md](AGENT_ROLES.md) except for the shared contract files, which change only when Agent 5 and the affected owner both agree.

## Local run shape (after implementation)

Backend and frontend commands will be written into the README only once they have been executed successfully. Expected shape:

- Backend: `uvicorn app.main:app --reload` from `backend` on port 8000
- Frontend: `npm run dev` from `frontend` on port 3000
- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`

## Explicit non-goals for the seven days

- Predicting the safest fuel or a fire-danger score
- Automated crawling of the entire NTRS catalog
- User uploads that mutate verified rows
- Evidence-graph visualization and conflict detection beyond the divergence card
- Deployment to a paid host

Those items stay in the future-work list in [REQUIREMENTS.md](REQUIREMENTS.md).
