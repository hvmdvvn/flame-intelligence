# Vercel deployment — 14 November 2026

## Live services

* Frontend: https://flame-intelligence.vercel.app
* Backend: https://flame-intelligence-api.vercel.app
* Backend readiness: https://flame-intelligence-api.vercel.app/api/ready
* Same-origin frontend readiness: https://flame-intelligence.vercel.app/service/api/ready

Both projects were created in the authenticated `nexus-f8e7` Vercel scope. Production deployments reached **READY**:

| Project | Deployment ID | Result |
|---|---|---|
| flame-intelligence | dpl_DDuCqiwEnrcLGaSaiNBU6UgKY6tD | Production alias active |
| flame-intelligence-api | dpl_aAkNA3MpZjEoEFTRYwkGrdBZTKhJ | Production alias active |

No credentials are committed. Local `.vercel` project links are ignored. Frontend `FLAME_API_ORIGIN` is saved in the project environment and points to the backend production alias. The browser uses `/service/api/*`; Next.js rewrites these requests server-side to the API, avoiding a hardcoded localhost endpoint and cross-origin browser requests. Production and preview builds require this origin. Optional `NEXT_PUBLIC_API_BASE_URL` remains available for explicit local overrides.

## Verification performed

* The complete backend suite passed **64 tests** after the runtime adaptation. The final storage-mode addition passed five API/runtime tests.
* Frontend TypeScript checking passed; Vercel's production Next.js build completed successfully.
* Live anonymous HTTPS requests returned HTTP 200 for readiness and persisted investigations.
* Live Chrome verified proxied health/readiness, **20 investigations**, **40 sources**, search/detail, mission ranking, source-complete report download with SHA-256, question → original evidence passage, and published analytics.
* No browser page errors occurred during these checks. Actual results: [`qa/vercel-live-checks.json`](../qa/vercel-live-checks.json). Screenshot: [`qa/vercel-live-overview.png`](../qa/vercel-live-overview.png).

The reusable verification command is:

```powershell
cd frontend
node scripts/verify-deployment.mjs https://flame-intelligence.vercel.app
```

It requires installed Playwright dependencies and Chrome on Windows, or Playwright Chromium on Linux. It performs read/query/report workflows; it does not import scientific data or train models.

## Redeploy

Use the authenticated Vercel CLI from the corresponding linked directory:

```powershell
cd backend
npx --yes vercel@65.15.0 deploy --prod --yes
```

```powershell
cd frontend
npx --yes vercel@65.15.0 deploy --prod --yes
```

On a new checkout, use `vercel link --project flame-intelligence-api` in `backend`, and `vercel link --project flame-intelligence` in `frontend`, selecting the existing `nexus-f8e7` scope. Reuse these existing projects rather than creating duplicate projects.

## Storage boundary

Vercel serves a copy of the bundled, attributed research corpus. The backend copies JSON seeds into temporary writable storage and rebuilds SQLite there. `/api/health` and `/api/ready` disclose `storage_mode: ephemeral_seed`. This state is disposable and is not shared between function instances. Original local PDFs, local SQLite databases, secrets and quarantined files are excluded from uploads.

The hosted service supports corpus search, inspection, deterministic rankings, analytics and report generation. Durable authorized imports continue to require the local persistent installation or a future external database/object-storage integration. No durable cloud ingestion or predictive model is claimed. See [backend runtime details](vercel-backend.md).

## Local services

The task also started the local frontend at http://127.0.0.1:3000 and backend at http://127.0.0.1:8000. Both returned successful readiness/page responses before handoff. They remain running for local use until their processes or the machine are stopped.
