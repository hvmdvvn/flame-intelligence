# Architecture audit — 14 November 2026

Inspected the executed routes, source modules, JSON corpus, dependency manifests, tests, and frontend components before implementation. The repository initially has no tracked application commit (all application files are untracked); no user files have been removed.

## Existing architecture

* Next.js 15.5.29 App Router / React 19 / TypeScript / Tailwind / Recharts. Routes: overview, paper explorer, paper detail, ask, evidence, comparison. Client fetches FastAPI directly through `NEXT_PUBLIC_API_BASE_URL`.
* FastAPI/Pydantic backend: `main.py` calls `corpus.py`, `rag.py`, and `compare.py`. JSON manifest, page extracts, study annotations, and chunks are persisted on disk. SQLite FTS5 is a rebuildable passage index, not a scientific data database.
* `ingest.py` queries NTRS, downloads PDFs, parses with PyMuPDF, writes manifest/extracts, rebuilds FTS. PSI is only probed; no PSI dataset ingestion exists.
* Corpus: 12 NTRS records, 720 stored chunks, four manually annotated study/value pairs. One value is an observed spread rate; three are explicitly reported computational model results. They must not be pooled as experimental training observations.
* RAG uses BM25 FTS5 plus lexical overlap and exact sentence extraction. Optional Ollama/OpenAI-compatible interpretation is guarded only by a numeric whitelist; this does not establish factual entailment. No semantic embedding model, evaluation harness, contradiction resolution, or semantic claim verifier exists.
* Comparisons preserve missing values and gate charts on gravity, fuel, measurement definition, unit and verification. Missing conditions and model/observation distinctions require stronger handling.
* No authentication, public writes, job queue, migrations, Docker, CI, observability, or production deployment configuration exists. Environment example describes a `.env` workflow but Python does not load dotenv files.

## Baseline checks

* `cd backend; ../.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider --basetemp=../.test-tmp-baseline`: **11 passed**. Default pytest temporary path fails under this execution sandbox; root invocation also lacks the backend import path.
* `cd frontend; npm run build`: **failed** because `next/font/google` requires blocked outbound Google Fonts access. This is a pre-existing reproducibility defect.
* No pre-existing component, browser, accessibility, or dependency-security checks.

## Critical risks

1. Re-running legacy NTRS ingest can replace a good manifest with an empty/partial one after outages.
2. File lookup constructs extract paths from unvalidated paper IDs.
3. LLM output can introduce unsupported qualitative assertions despite passing a number check.
4. Comparing reported computational values to observations can hide evidence-class differences.
5. NASA links and local annotations are not proof of measurement calibration, scientific validation, or safety certification.

The existing routes and data files will remain compatible. New research persistence will complement, rather than replace, the NTRS evidence archive.
