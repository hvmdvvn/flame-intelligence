# Agent roles

Six workstreams, one repository, one `paper_id`. No workstream is complete until its acceptance checks have been executed and the result is written under `qa/` or the module test log.

The application code is not in the repository yet. Ownership below applies once implementation starts.

## Ownership rules

- Edit files in your tree. Do not restyle another agent's module while "integrating."
- Shared files: `DATA_SCHEMA.md`, `API_CONTRACTS.md`, `backend/app/schemas/`. Agent 5 lands schema changes. The affected agent reviews them in the same change.
- A paper id is created only by Agent 2, from a real source identifier.
- A measurement with `verification_status: verified` is written only by Agent 3 after the page check.
- Agent 4 does not compute comparability in the browser.
- Agent 1 does not answer from model memory when the evidence gate fails.

## Agent 1 — AI / RAG

**Mission.** Chunk page text, retrieve passages, run the evidence gate and citation auditor, and produce a claim docket.

**Owns**

- `backend/app/services/rag/`
- `backend/data/chunks.json` (builder only; source text comes from Agent 2)
- `backend/tests/test_rag.py`

**Depends on.** Agent 2 page extracts. Agent 5 ask route calling this service.

**Deliverables**

- Chunk builder that preserves `paper_id`, title, page, URL
- Keyword retriever that works with no extra model download
- Optional sentence-transformer + FAISS index behind the same search function
- Evidence gate and citation auditor
- Model adapter for Ollama and an OpenAI-compatible endpoint
- `passages_only` behavior when no model is configured

**Acceptance**

- A question about a held paper returns a chunk from that paper.
- A reported claim's quote is a substring of that chunk.
- A question with no supporting chunk returns `answer_mode: insufficient` and does not call the model.
- A fixture that makes the model cite an unknown chunk is rejected by the auditor.
- Tests in `test_rag.py` pass.

**Day 3 milestone.** One real paper supports question → passage → cited claim.

## Agent 2 — NASA data ingestion

**Mission.** A small, traceable corpus from NTRS and PSI.

**Owns**

- `backend/app/services/ingestion/`
- `backend/data/manifest.json`
- `backend/data/extracts/`
- `backend/data/raw/` (gitignored PDFs)
- `backend/data/EXTRACTION_REPORT.md`

**Depends on.** Public source availability.

**Deliverables**

- Search notes for the focus topics
- Manifest rows with official URLs and honest `pdf_status`
- Unmodified PDFs for records that download
- Page JSON from PyMuPDF or pdfplumber
- Extraction report: scanned pages, bad reading order, lost tables

**Acceptance**

- At least five relevant records have metadata and page text, or the report documents why fewer were accessible and lists the official URLs that were checked.
- Every row has a real `official_url` that was opened.
- No author, year, or abstract was filled in from memory.
- Sample pages were read against the PDF.

**Day 2 milestone.** Five records ready, or a written access limit with the records that did work.

## Agent 3 — Scientific data

**Mission.** Verified measurements and a deterministic comparability gate.

**Owns**

- `backend/app/services/comparison/`
- `backend/data/studies.json`
- `backend/data/data_dictionary.md`
- `backend/tests/test_comparison.py`

**Depends on.** Agent 2 PDFs and page text. Agent 3 still checks numbers on the original page.

**Deliverables**

- Data dictionary of fields actually used
- Study and measurement rows
- Gate implementing the reason codes in `DATA_SCHEMA.md`
- Either one verified comparable pair or one explicit non-comparable pair

**Acceptance**

- Every `verified` number has a page and a table or figure location.
- A unit test proves null is not coerced to zero.
- A unit test proves gravity or fuel mismatch sets `chart_allowed: false`.
- A unit test proves an oxygen difference with otherwise matched conditions returns `comparable_with_caveat`.
- No synthetic measurement is marked verified.

**Day 4 milestone.** Dataset and gate ready for the compare route.

## Agent 4 — Frontend

**Mission.** The evidence bench: Source Stack, Claim Docket, Passage Lens, Comparability Gate, The Unsaid.

**Owns**

- `frontend/`

**Depends on.** Live or fixture responses that match `API_CONTRACTS.md`. Fixtures used in Storybook-style development must be labeled and must not ship as the demo data source. The demo build calls the API.

**Deliverables**

- Next.js TypeScript app, Tailwind, Recharts used only behind `chart_allowed`
- Routes listed in `ARCHITECTURE.md`
- Loading, empty, and error states
- Environment-based API base URL

**Acceptance**

- Home counts come from `/api/stats`.
- A paper in the list opens detail with the official link.
- Ask renders reported claims, interpretations, and insufficient evidence as different states.
- A citation navigates to the Passage Lens for that `chunk_id`.
- Compare shows units, missing fields, and warnings, and does not mount a chart when `chart_allowed` is false.
- Layout is usable at desktop width and at 390px width.

**Day 1.** Bench wireframe approved (this architecture is that wireframe). **Day 5.** Views on the integrated API.

## Agent 5 — Backend integration

**Mission.** FastAPI shell, shared Pydantic models, routes, configuration, and error mapping.

**Owns**

- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/schemas/`
- `backend/app/routes/`
- `backend/app/storage/`
- `backend/pyproject.toml`
- `backend/tests/test_api.py`
- `.env.example`

**Depends on.** Contracts in this repository. Service functions from Agents 1–3. Agent 5 may land interface stubs that return empty corpora, then replace the stub bodies with real service calls without changing the JSON shapes.

**Deliverables**

- Health, stats, papers, evidence, ask, studies, compare
- Loaders that fail loudly on schema violations
- `.env.example` with `LLM_PROVIDER`, `OLLAMA_MODEL`, `LLM_BASE_URL`, `LLM_API_KEY`, `CORS_ORIGINS`
- README run commands after they have been executed

**Acceptance**

- `GET /api/health` returns `ok` on a machine with the corpus files present, including an empty valid corpus.
- Invalid compare body returns `400`.
- Unknown ids return `404` using the error object.
- Ask and compare responses validate against the Pydantic models.
- API tests pass against the service layer, not a mocked JSON file that bypasses the gate.

**Day 1 milestone.** Server runs and the contract file is the one in this repo.

## Agent 6 — QA and validation

**Mission.** Tests, citation audits, issue log, demo script.

**Owns**

- `qa/TEST_PLAN.md`
- `qa/ISSUE_TRACKER.md`
- `qa/questions.json`
- `qa/CITATION_AUDIT.md`
- `qa/DEMO.md`
- `backend/tests/test_journey.py`
- The limitations section of the README

**Depends on.** Each module as it appears. Testing starts the day the first route exists.

**Deliverables**

- 15 questions: factual, comparison, and unanswerable
- Issue tracker with severity, owner, status, retest
- Citation audit for every demo claim
- Measurement audit for every plotted point
- Journey test notes
- Demo script matching the three-minute story
- Backup notes if a model or a PDF is unavailable

**Acceptance**

- Journey checklist in the user request is marked pass or fail with evidence, not assumed.
- At least one unanswerable question is shown to return insufficient evidence.
- Incompatible studies do not chart.
- Known source-access limits are written in the README.

## Integration sequence

Agent 5 publishes empty-but-valid endpoints first. Agent 2 fills the manifest. Agent 1 indexes real pages. Agent 3 adds only checked rows. Agent 4 binds the UI to those endpoints. Agent 6 runs the journey after each join, not on the last day.

## Conflict rule

If a screen needs a field that is not in `API_CONTRACTS.md`, stop and extend the contract. Do not hide the field in a component-local fetch.
