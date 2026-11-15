# Tasks

Implementation has not started. Boxes stay open until the named check has been run.

Order is by dependency. Agents 4 and 6 can prepare wireframes and the question list while Agent 2 is still collecting, but they cannot mark UI or audits complete on empty data.

## Dependency order

1. Freeze ids and contracts (this repository).
2. Backend skeleton and health endpoint (Agent 5).
3. Ingest the first real records (Agent 2). Blocks truthful UI stats, RAG, and measurements.
4. Keyword retrieval, evidence gate, ask route (Agents 1 and 5).
5. Study rows and compare route (Agents 3 and 5). Can start the gate against fixtures, but verified rows wait for PDFs.
6. Bench UI on live endpoints (Agent 4).
7. Passage Lens and citation wiring.
8. Journey tests, citation audit, demo script (Agent 6).
9. Optional FAISS index and local LLM narration. The keyword path and `passages_only` mode must already work.

## Agent checklists

### Agent 1

- [ ] Chunk builder from page extracts, page boundaries respected
- [ ] Keyword index
- [ ] Evidence gate with a tested threshold or overlap rule
- [ ] Citation auditor
- [ ] LLM adapter from environment variables
- [ ] `test_rag.py` covering grounded, insufficient, and forged-citation cases

### Agent 2

- [ ] Topic search log for NTRS and PSI
- [ ] Manifest with official URLs only
- [ ] PDFs stored unmodified under `backend/data/raw/`
- [ ] Page extracts and quality flags
- [ ] `EXTRACTION_REPORT.md` including records that could not be downloaded

### Agent 3

- [ ] Data dictionary grounded in papers that were read
- [ ] `studies.json` with provenance on every verified value
- [ ] Gate unit tests for mismatch, caveat, and null-as-zero
- [ ] One demo pair: comparable or explicitly not comparable

### Agent 4

- [ ] App shell and five instruments
- [ ] Stats, list, detail, ask, evidence, compare bound to the API
- [ ] Chart mounted only when `chart_allowed` is true
- [ ] Empty, error, loading, and mobile layout checked in a browser

### Agent 5

- [ ] FastAPI app and Pydantic schemas matching the contract
- [ ] All routes in `API_CONTRACTS.md`
- [ ] `.env.example`
- [ ] `test_api.py`
- [ ] Run commands added to the README after a successful local start

### Agent 6

- [ ] `qa/questions.json` with at least 15 questions
- [ ] Issue tracker
- [ ] Journey test
- [ ] Citation and measurement audits for the demo path
- [ ] Demo script and limitation statement

## Seven-day plan

The proposal and the team report both use seven days. This plan keeps their milestones and aims the demo at the evidence bench.

### Day 1 — Contracts and skeleton

Agree the bench (Source Stack, Claim Docket, Passage Lens, Comparability Gate, The Unsaid). Backend health endpoint. Test plan and 15 candidate questions started. Agent 2 begins the source list with PDF access status, without inventing metadata.

**Done when:** health returns `ok`, question file exists, at least five candidate URLs are written down with access status.

### Day 2 — Corpus

Download accessible PDFs. Extract pages. Dashboard shell can render an empty or partial manifest from the API. No fake counts.

**Done when:** five records have metadata and page text, or the extraction report states the access limit and lists what was retrieved.

### Day 3 — First real journey

Index one paper. Ask a question. Show the passage and the citation in the Claim Docket and Passage Lens.

**Done when:** a person who was not the RAG author can follow that path on the local app.

### Day 4 — Gate

Verify measurements against pages. Expose `POST /api/compare`. UI shows the divergence card or the allowed chart.

**Done when:** a unit test and a clicked-through pair agree.

### Day 5 — Join the bench

Wire every main view. Add The Unsaid from real insufficient questions and corpus limits. Remove unfinished surfaces.

**Done when:** the scripted journey crosses dashboard, record, question, citation, and comparison.

### Day 6 — Freeze

No new instruments. Fix integration defects. Confirm the app starts from a clean environment. Record a backup path if the model is down (`passages_only` still has to work).

### Day 7 — Audit

Re-check every demo citation and every plotted number. Finalize README limitations. Rehearse the three-minute story. Do not claim completion if the journey was not run.

## Journey checklist (the one that defines done)

- [ ] Application loads
- [ ] Home statistics match the manifest
- [ ] Source Stack lists authentic NASA records
- [ ] A selected paper shows stored metadata and the official URL
- [ ] A scientific question hits the RAG path
- [ ] Retrieved passages come from indexed pages
- [ ] When a model is configured, the claim docket is grounded and audited
- [ ] Citations show real titles and page numbers
- [ ] Opening a citation shows that chunk
- [ ] Two studies can be submitted to the gate
- [ ] The gate result, units, and warnings render
- [ ] An unsupported question returns insufficient evidence
- [ ] Missing data and request errors render as specified

## Risks

| Risk | What we will do |
| --- | --- |
| NTRS or PSI blocks downloads | Record the URL and status. Continue with records that do download. Do not replace them with invented papers. |
| PSI has no usable bulk API | Manual metadata entry from pages a human opened, still with the official URL. |
| PDF text is garbled or scanned | Flag the page. Keep it out of demo citations until someone checks it. |
| Embeddings model is large or offline | Ship keyword retrieval first. Same API. |
| No LLM key and no Ollama | `passages_only`. Do not fake a narrative answer. |
| Papers use different fuels, rigs, or gravity | Divergence card. Chart stays off. |
| Seven-day scope grows into a predictor | Must-have list in `REQUIREMENTS.md` is the cut line. |
| Parallel edits break ids | Only Agent 2 mints `paper_id`. Contract changes go through Agent 5. |

## Current repository fact

As of the planning commit boundary, this machine had no existing Flame Intelligence code. There is nothing to merge, mock over, or mark complete.
