# Feature inventory and gaps

| Category | Baseline finding | Implementation direction |
|---|---|---|
| Existing functionality | NTRS explorer/detail, page inspector, exact quotes, comparison gate | Preserve routes/contracts and annotations |
| Partial functionality | PSI probe only; limited conditions; weak model audit | Authorized offline PSI import; explicit missing fields; fail-closed AI |
| Missing functionality | Investigation registry, jobs, mission ranking, reports, history/transfer, model feasibility | Add persistent scientific workflows |
| Technical debt | Mutable ingest manifest, index rebuild races, Google font build fetch | Preserve good corpus on failure; startup index; local fonts |
| Data quality | 12 source records; four values including three model results | Keep raw/source provenance, separate evidence classes; do not invent PSI runs |
| AI reliability | Verbatim extraction works; numeric audit insufficient for generated prose | Structured cited interpretations and explicit inference labeling; adversarial tests |
| UI/UX | Existing responsive theme and evidence controls, excessive decoration | Extend navigation, usable filters/tables, readable methodology/empty states |
| Security | No public writes, but unvalidated file IDs and unbounded expensive queries | Safe identifiers, request limits, configurable CORS, rate limiting, safe imports |
| Testing | 11 baseline tests pass using workspace tmp path | Import/reproducibility, ranking, provenance, analytics and API tests; browser checks if available |
| Deployment | No container/CI/migrations, font build network dependency | Docker Compose, health/readiness, CI, backup and deployment instructions |

Unresolved source restrictions and insufficient measurements must be reported as unavailable, not satisfied using synthetic results. A deployment build alone will not establish production readiness.
