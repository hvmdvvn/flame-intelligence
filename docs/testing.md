# Verification

Backend on this Windows workspace:

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=../.test-tmp
..\.venv\Scripts\python.exe -m app.evaluate
```

Use a new or disposable test temporary directory; pytest clears its explicitly selected base directory. Linux CI can run `python -m pytest` normally. Root invocation should set `PYTHONPATH=backend` or run from `backend`.

Frontend: `npm ci`, `npm run typecheck`, `npm run build`, `npm run test:e2e`. On Windows the browser suite uses installed Chrome (override `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for another path); Linux requires `npx playwright install --with-deps chromium`. Tests launch the API at port 8011 and Next at 3011. No build-time Google font access is needed. CI runs backend tests, retrieval evaluation, frontend build, dependency scans and browser tests. Automated axe checks cover eight routes and do not establish full accessibility conformance.

Tests cover original APIs and comparison gates, strict ingestion/unit conversion and oxygen-basis preservation, immutable raw provenance, duplicate/checksum handling, quarantine atomicity, versioning, missing values, deterministic relevance and reports, unavailable models, invalid input/body/rate controls, generated citations, numerical fidelity and instruction-like input rejection. Synthetic numerical fixtures are isolated to tests and explicitly labeled. The source-referenced evaluation is a small regression suite, not expert validation of all scientific claims.

`python -m app.benchmark` measures local warm deterministic operations and records hardware/runtime/data volume and p50/p95. Its results do not establish production concurrency, network latency or scalability. See `qa/verification-report.md` for actual executed outcomes and remaining gaps.
