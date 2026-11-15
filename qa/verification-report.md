# Implementation verification and remaining limitations

Review date: **14 November 2026 (Asia/Karachi)**. This is the actual implementation record, not a production-readiness certification.

**Deployment update:** the subsequent Vercel deployment is live at https://flame-intelligence.vercel.app, with backend https://flame-intelligence-api.vercel.app. Its production builds and live browser workflows passed. The original implementation-time deployment table below is retained as history; see [the current deployment report](../docs/vercel-deployment.md) and [live check results](vercel-live-checks.json). The backend suite now contains 64 passing tests including the Vercel runtime checks. Hosted storage is an ephemeral published-corpus copy; durable imports remain local.

## Delivered behavior

The existing Next.js/FastAPI stack, publication URLs, extracts, study annotations and API contracts are preserved. New SQLite persistence provides an attributed investigation/source registry and dataset → run → measurement relationships with SQL migrations. Operator-only CSV/TSV/JSON ingestion provides whole-file validation, immutable content-addressed raw artifacts, explicit SI conversions, versioning, atomic commit, concurrent deduplication, quarantine and persistent job/provenance reports. Original oxygen bases, units and uncertainty remain intact.

The application now supports persisted investigation search/filter/pagination, detail/source inspection, qualitative multi-investigation comparison, existing quantitative comparison safeguards, deterministic adjustable mission ranking with missing-condition/gravity gaps, browser-local mission configurations, scientific report exports, run-separated descriptive analytics, and explicit predictive unavailability. Historical incidents and technology-transfer accounts retain sources and publication-era limits.

The existing extractive research assistant still resolves exact paper/page passages. Generated interpretations use strict schemas and known excerpt references, remain hypotheses, and fail closed on invalid citations/additional numbers/detected instructions/certification language. A regression exposed unrelated-subject answers from generic-word overlap; the coverage gate was tightened. No semantic entailment or expert-reviewed scientific accuracy is asserted.

## Scientific corpus and sources

* **20 registered investigation metadata records**: BASS, BASS-II, SAFFIRE-I, SAFFIRE-II, SAFFIRE-III, SAME, SAME-R, FLEX, FLEX-2, CFI, ACME, BRE, E-FIELD, CFI-G, SPICE, SLICE, DAFT, DAFT-2, SOFIE, and PSI-62.
* **40 registered sources**: 28 curated NASA resources plus the existing 12 NTRS publications; **720 existing passage chunks**.
* Five official indexed PSI landing-page metadata records (PSI-25, PSI-69, PSI-98, PSI-101, PSI-62), with identifiers, DOI, version and stated rights. Metadata retrieval is distinguished from raw-file acquisition.
* **Zero raw PSI datasets/runs imported** in the delivered corpus. Direct PSI browser access was unreadable, and no supported public PSI API was established. An authorized offline acquisition/import workflow is implemented and documented.
* Four existing manually transcribed publication values: **one observed spread rate and three computational results**, kept outside raw training data. A five-row PSI table snapshot is preserved as unvalidated source metadata, excluded from analysis/model training.
* Seven NTRS publication-year corrections are overlaid with original values and source references. Ten of twelve official citation pages were rechecked; two were inaccessible. Original manifest/extracts remain unchanged.
* Three historical incidents, four Earth application entries, and two educational links. The videos could not be retrieved and supply no experimental evidence. Apollo 13 is classified as an oxygen-system failure/explosion.

Source identities, dates, rights, inconsistencies and retrieval methods: [data-sources.md](../docs/data-sources.md). All resources named in the brief were investigated, including failed retrievals.

## Executed verification

| Check | Actual outcome |
|---|---|
| Baseline backend suite | 11 passed with workspace-local temporary path |
| Baseline frontend build | Failed because Google Fonts downloads were blocked; fixed by local font stacks |
| `cd backend; ../.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider --basetemp=../.test-tmp-verified` | **62 passed**; two dependency deprecation warnings, no failures |
| `python -m app.evaluate` | **6/6 source-referenced regression cases passed**, exact quote/citation checks and one known numerical value; generative provider disabled |
| `cd frontend; npm run typecheck` | Passed |
| `cd frontend; npm run build` | Passed after removal of build-time font downloads and PostCSS update; standalone output configured |
| `cd frontend; npm run test:e2e` | **16 Chrome/Playwright tests passed** in the full run, including discovery/comparison, ranking/save/restore/export, evidence inspector, unavailable modeling, historical context, error recovery and mobile keyboard navigation |
| Automated accessibility | **8 page scans, zero axe WCAG-tagged violations**; this does not establish full WCAG conformance or substitute for manual assistive-technology review |
| Python dependency audit | Final installed-environment `pip-audit 2.10.1`: **48 packages, zero known advisories, zero skipped**. Initial advisories fixed through compatible FastAPI/Starlette/pytest updates; exact initial/final JSON retained |
| Node dependency audit | `npm audit --json`: **zero known vulnerabilities** after compatible PostCSS override; actual JSON retained |
| Python dependency consistency | `pip check` passed; constrained dry-run install passed |
| `docker --config .cache/docker compose config --quiet` | Passed (configuration validation only) |
| Container build/runtime | **Not executed**: installed Docker client cannot reach a running daemon |
| Live production deployment | **Not performed**; no hosted service or public endpoint created |

The browser suite uses installed Chrome on Windows; Linux CI installs Playwright Chromium. The Windows sandbox initially prevented server teardown, so the test process was run with approved local execution permissions and exited cleanly. Early test locator ambiguities were corrected. No failed check has been represented as passing.

The backend tests cover API/database operations, imports and recovery, immutable provenance, unit conversions and oxygen bases, nonfinite/overflow values, missing data, duplicate and concurrent imports, scientific comparability, source/ID resolution, observed/model separation, versioned rankings/reports, request limits, operator authorization, path/download integrity, and structured AI output. Synthetic fixtures exist only in isolated tests. There is no isolated frontend component-unit suite; browser tests exercise the actual components through complete workflows.

## Performance and example research workflow

[benchmark-results.json](benchmark-results.json) records Windows 11, Intel64 Family 6 Model 151, Python 3.12.7, 20 investigations, 40 sources, 12 papers, 720 chunks and zero imported measurements. Across 100 sequential warm in-process calls: metadata search p95 **5.363 ms**, mission ranking p95 **11.600 ms**. This excludes HTTP/browser/network/concurrency and is not a scalability claim.

[example-lunar-report.json](example-lunar-report.json) is an executed report for a **user-selected illustrative research target**, 0.34 oxygen volume fraction and 70 kPa. These values are scenario inputs, not NASA measurements. It ranks BASS-II highest under its disclosed lexical weights while explicitly reporting missing partial-gravity evidence and zero validated raw runs. The report contains configuration, components, limitations, source registry, model feasibility and a SHA-256 reproducibility digest. Rankings are relevance heuristics, not fire probabilities or approval of the example environment.

## Files and modules changed

* Existing backend modules extended: `app/main.py`, `config.py`, `corpus.py`, `compare.py`, `rag.py`, `schemas.py`, `ingest.py`; `requirements.txt` updated and `constraints.txt` added.
* New backend modules: `research_store.py`, `import_data.py`, `intelligence.py`, `evaluate.py`, `benchmark.py`; `migrations/001_research.sql`; `data/research_catalog.json`, `data/evaluation-v1.json`.
* New backend tests: `test_import_data.py`, `test_intelligence.py`, `test_reliability.py`, `test_catalog_integrity.py`; original tests preserved.
* Frontend: overview, shared navigation/styles/layout, research types and UI helpers, investigation list/detail, mission workspace, analytics, source/history/transfer views; existing assistant/comparison/evidence/publication routes preserved and verified. `package.json`/lockfile, standalone Next configuration, Playwright configuration/tests added or updated.
* Operations: backend/frontend Dockerfiles and dockerignore files, backend `entrypoint.py`, root `compose.yaml`, `deploy/nginx.conf`, `.github/workflows/verify.yml`, `.env.example`, `.gitignore`, `README.md`.
* Documentation: architecture audit, feature gaps, implementation plan, architecture, data sources, importing data, scientific methodology, AI reliability, model feasibility, API, deployment, security, testing and limitations under `docs/`.
* Evidence artifacts: evaluation, benchmarks, source-complete example report, actual dependency audit outputs and this report under `qa/`.

The repository initially held application files as untracked content. No existing dataset or working feature was deleted, and no Git commit was created on the user's behalf.

## Outstanding work and acceptance boundaries

Raw PSI acquisition remains an operator step; native XLSX/PDF/image/video measurement adapters, semantic embeddings/hybrid vector retrieval, automated contradiction analysis, expert-reviewed scientific evaluation, durable distributed jobs and authenticated multiuser server workspaces remain unimplemented. Optional LLM providers were schema/adversarial-tested with fixtures but no external generative model was evaluated. No predictive model or independent model-accuracy result exists. Data gaps prevent quantitative oxygen-enriched lunar habitat equivalence or partial-gravity prediction.

Docker runtime, Linux-container dependency compatibility, production TLS/identity/monitoring/backups, full manual accessibility review and realistic high-volume/concurrent load testing remain deployment gates. Python version constraints are not a wheel/hash lock. CI configuration is supplied but no remote CI run was triggered. Known parser/proxy/index/concurrency and scientific limitations are documented in [security](../docs/security.md), [deployment](../docs/deployment.md), and [limitations](../docs/limitations.md).

These are functioning, verified improvements to the existing platform. The full master brief is **not claimed complete**, and the service is **not certified production-ready**.
