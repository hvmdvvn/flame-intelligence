# FastAPI deployment on Vercel

The backend is a separate Vercel project rooted at `backend/`. Vercel discovers `index.py:app`, installs `requirements.txt`, and serves the existing FastAPI paths unchanged. Python 3.12 is selected in `.python-version`. `vercel.json` declares the FastAPI framework and a 60-second function limit. `.vercelignore` excludes original PDFs, local SQLite databases/indexes, secrets, tests and caches; attributed JSON seed files and SQL migrations remain bundled.

Deploy from the repository root with an authenticated Vercel CLI:

```powershell
vercel link --project flame-intelligence-api --scope nexus-f8e7 --yes
vercel deploy --prod --yes
```

Retain the resulting backend HTTPS origin, then set frontend `FLAME_API_ORIGIN` to it. The frontend's server-side rewrite forwards `/service/*` to the backend; the browser uses `/service/api/*`. Leave `NEXT_PUBLIC_API_BASE_URL` unset to use this same-origin path. Keep the operator token unset for a public read-only research deployment, and configure any LLM credentials only as backend server environment variables. No credential is required for source search and deterministic analysis.

## Writable filesystem adaptation

Vercel function application files are read-only. `app/vercel_runtime.py` copies only the shipped manifest, study annotations, passage chunks, catalog and JSON extracts into a release-digest/PID-specific directory under temporary scratch storage. Existing SQLite registry/index code then operates on that writable copy. Original PDF files are not copied or offered as deployment downloads. The local `uvicorn app.main:app` entrypoint remains unchanged and continues to use persistent `FLAME_DATA_DIR` behavior.

**Scratch state is ephemeral.** A cold start reseeds the checked-in corpus. Imports, custom dataset changes, job histories and other mutations in this scratch directory do not survive reliably and are not shared between function instances. This deployment is for the published research corpus and its deterministic read/query/report workflows. Durable dataset ingestion requires external persistent storage and an independently designed database/object-storage integration. The CLI importer is not exposed as a web route.

The in-memory abuse limiter is also instance-local; Vercel infrastructure can create multiple function instances. Configure Vercel Firewall/platform rate limits before opening a high-volume public service. No distributed quota guarantee is implied by this adaptation.

## Verification

`tests/test_vercel_runtime.py` verifies concurrent/idempotent scratch initialization, source preservation, omission of original raw files, readiness, source search and ranking using an isolated synthetic corpus. A separate local smoke check with the shipped authentic seed records returned readiness HTTP 200, 20 investigation records and 40 source records, with no raw directory copied. Vercel deployment status and live HTTPS checks must be reported separately; this document does not claim a completed deployment.

Official implementation references: [Vercel FastAPI](https://vercel.com/docs/frameworks/backend/fastapi), [Python runtime and bundle exclusions](https://vercel.com/docs/functions/runtimes/python), and [read-only runtime filesystem with temporary scratch space](https://vercel.com/docs/functions/runtimes).
