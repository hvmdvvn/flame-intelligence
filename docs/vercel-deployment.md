# Vercel deployment — 15 November 2026

## Live services

* Frontend: https://flame-intelligence.vercel.app
* Backend: https://flame-intelligence-api.vercel.app
* Backend readiness: https://flame-intelligence-api.vercel.app/api/ready
* Same-origin frontend readiness: https://flame-intelligence.vercel.app/service/api/ready

Both projects were created in the authenticated `nexus-f8e7` Vercel scope. Production deployments reached **READY**:

| Project | Deployment ID | Result |
|---|---|---|
| flame-intelligence | dpl_777SJVSGnFt7r3sLgs5x2oQiYPes | READY, production alias active |
| flame-intelligence-api | dpl_7wkiPS5tbwAx6DJu1Ror7HCzvsQD | READY, production alias active |

Both services were redeployed from application source revision `c26937702af66afac780f153decfaf10aa21fb7b` on 15 November 2026. The frontend and backend production aliases above point to these deployments.

No credentials are committed. Local `.vercel` project links are ignored. Frontend `FLAME_API_ORIGIN` is saved in the project environment and points to the backend production alias. The browser uses `/service/api/*`; Next.js rewrites these requests server-side to the API, avoiding a hardcoded localhost endpoint and cross-origin browser requests. Production and preview builds require this origin. Optional `NEXT_PUBLIC_API_BASE_URL` remains available for explicit local overrides.

## Verification performed

* The complete backend suite passed **64 tests** locally and in GitHub Actions on Linux. Backend evaluation and dependency audit passed in GitHub Actions.
* All **42 browser tests** passed in GitHub Actions. Frontend production build and dependency audit passed there, and Vercel's production Next.js build completed successfully.
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

Both projects now use the GitHub repository layout: root directory `frontend` for `flame-intelligence`, and `backend` for `flame-intelligence-api`. Node.js is pinned to 22.x. Run the authenticated Vercel CLI from the **repository root**, linking the project to deploy:

```powershell
npx --yes vercel@65.15.0 link --project flame-intelligence-api --scope nexus-f8e7 --yes
npx --yes vercel@65.15.0 deploy --prod --yes
```

```powershell
npx --yes vercel@65.15.0 link --project flame-intelligence --scope nexus-f8e7 --yes
npx --yes vercel@65.15.0 deploy --prod --yes
```

Reuse the existing projects rather than creating duplicate projects. Do not deploy from the subdirectories after setting these root directories. Root `.vercelignore` excludes secrets, local databases, original PDFs, dependency caches and QA artifacts from CLI uploads.

## GitHub

The complete tracked project is published to [hvmdvvn/flame-intelligence](https://github.com/hvmdvvn/flame-intelligence), branch `main`. GitHub reports it as public at final verification. The initial Git upload repeatedly failed with HTTP 408; GitHub API uploads preserved every tracked file and verified their Git object hashes. Subsequent small Git pushes succeeded. Local `main` tracks `origin/main`.

Direct production deployment through the CLI works. Automatic GitHub-to-Vercel deployment is pending the Vercel GitHub integration; `vercel git connect` was rejected for both projects, including after the repository became public. Connect the GitHub account in Vercel and grant the Vercel GitHub app access to the repository, then run from the repository root:

```powershell
npx --yes vercel@65.15.0 git connect https://github.com/hvmdvvn/flame-intelligence.git --project flame-intelligence-api --scope nexus-f8e7 --yes
npx --yes vercel@65.15.0 git connect https://github.com/hvmdvvn/flame-intelligence.git --project flame-intelligence --scope nexus-f8e7 --yes
```

## Storage boundary

Vercel serves a copy of the bundled, attributed research corpus. The backend copies JSON seeds into temporary writable storage and rebuilds SQLite there. `/api/health` and `/api/ready` disclose `storage_mode: ephemeral_seed`. This state is disposable and is not shared between function instances. Original local PDFs, local SQLite databases, secrets and quarantined files are excluded from uploads.

The hosted service supports corpus search, inspection, deterministic rankings, analytics and report generation. Durable authorized imports continue to require the local persistent installation or a future external database/object-storage integration. No durable cloud ingestion or predictive model is claimed. See [backend runtime details](vercel-backend.md).
