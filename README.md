# Flame Intelligence

A microgravity combustion research platform built on the existing Next.js / FastAPI evidence archive. Explore source-backed investigations, inspect NTRS passages, compare studies with scientific gates, rank mission evidence using disclosed weights, and export reproducible research reports.

Independent research software. Not NASA-endorsed; does not certify fire safety or predict spacecraft fire risk.

Live application: **https://flame-intelligence.vercel.app**. See [Vercel deployment and storage limits](docs/vercel-deployment.md). The hosted version serves the published corpus; durable dataset imports use the local installation.

## Run locally

Python 3.12 and Node.js 22 are recommended. From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -c backend/constraints.txt -r backend/requirements.txt
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. API documentation: <http://127.0.0.1:8000/docs>. Export environment variables from `.env.example`; the Python service does not auto-load dotenv files. The SQLite schema and registry seed initialize automatically. Search, rankings and analytics require no model credentials.

Container configuration: `docker compose up --build -d`, then <http://127.0.0.1:8080>. See [deployment and backup instructions](docs/deployment.md); actual verification status is recorded in [the verification report](qa/verification-report.md).

## Research workflows

* **Investigations**: persisted search and facets, details, metadata comparison, source references, original-file availability, explicit unknown conditions.
* **Publications / assistant**: preserved archive of 12 NTRS papers and 720 passage chunks; exact quotes link to their paper and PDF page. Optional generated interpretations remain hypotheses with structured citation/numeric checks.
* **Mission workspace**: configurable relevance weights, atmospheric targets, gravity mismatch and evidence gaps; browser-local saved configurations and downloaded reports. Scores measure relevance, never safety.
* **Analytics**: validated imported measurements grouped by run and definition; four existing publication values remain separately labeled (one observation, three reported model values). No trained model is available.
* **Sources and context**: NASA source registry, historical incidents including the Apollo 13 oxygen-tank explosion, historical technology transfer and educational-link access status.

The catalog has 20 investigation records covering all 18 requested families plus SoFIE and PSI-62. The registry has 28 curated NASA source records plus 12 existing NTRS records. Five PSI landing-page metadata records have verified identifiers/DOIs; no raw PSI files were downloaded. See [data sources](docs/data-sources.md) for identities, versions, rights, access limitations and bibliographic corrections.

## Import authorized scientific data

The operator-only importer supports UTF-8 CSV, TSV and JSON. It records immutable raw artifacts, checksums, source/run provenance, validated and normalized data, versioned jobs and quarantined errors. It never fetches arbitrary URLs. Download PSI files legitimately through NASA's documented browser workflow, then prepare reviewed metadata and map columns using [the import guide](docs/importing-data.md).

```powershell
cd backend
..\.venv\Scripts\python.exe -m app.import_data ingest path/to/authorized.csv --metadata path/to/source.json
..\.venv\Scripts\python.exe -m app.import_data jobs
```

The original NTRS workflow `python -m app.ingest` remains available; successful records are merged with the existing corpus, and failed retrieval cannot erase it.

## Verify

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=../.test-tmp
..\.venv\Scripts\python.exe -m app.evaluate
..\.venv\Scripts\python.exe -m app.benchmark
```

From `frontend`, run `npm run build` and `npm run test:e2e`. Pytest clears its selected temporary base directory, so use a disposable test path. See [testing](docs/testing.md) for platform prerequisites and actual verification limits.

See [architecture](docs/architecture.md), [scientific methodology](docs/scientific-methodology.md), [AI reliability](docs/ai-reliability.md), [API](docs/api.md), [security](docs/security.md), [model feasibility](docs/model-validation.md), and [remaining limitations](docs/limitations.md). The audit/gap/implementation documents describe the inspected baseline. Original root planning documents are retained as historical plans and may describe unimplemented capabilities.
