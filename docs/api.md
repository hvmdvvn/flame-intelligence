# API

FastAPI publishes current request schemas and response documentation at `/docs` and `/openapi.json`. Existing paper, page, evidence, ask, studies and comparison contracts are preserved.

| Endpoint | Behavior |
|---|---|
| GET `/api/health` | Corpus counts and model provider; liveness |
| GET `/api/ready` | Registry/index readiness, HTTP 503 on failure |
| GET `/api/investigations` | `q`, `category`, `gravity`, `limit` (1–200), `offset`; persisted paginated results |
| GET `/api/investigations/{id}` | Sources, metadata, datasets, runs and validated measurements |
| GET `/api/sources` | Provenance registry with retrieval status, versions and rights |
| GET `/api/datasets` | Optional `investigation_id` filter |
| GET `/api/datasets/{id}/download` | Checksum-verified original only if redistribution explicitly permitted |
| GET `/api/ingestion/jobs` | Recent jobs, requires `Authorization: Bearer FLAME_ADMIN_TOKEN`; disabled without token |
| POST `/api/rankings` | `question`, `mission`, optional weights, oxygen_fraction (0–1), pressure_kpa and gravity |
| POST `/api/reports` | Same input; downloadable JSON with configuration, provenance and reproducibility digest |
| GET `/api/analytics` | Descriptive imported groups and separately classified publication values |
| GET `/api/models` | Explicit unavailable state and data feasibility |
| GET `/api/context` | Source-backed historical, technology-transfer and educational records |

Ranking missions: `lunar_habitat`, `iss`, `mars_habitat`, `rover`, `spacecraft`. Weight keys: `topic`, `gravity`, `conditions`, `quantitative`, `provenance`; nonnegative, at least one positive. Scientific input models reject unknown fields, nonfinite numbers and invalid ranges.

Errors use `{ "error": { "code": "...", "message": "..." } }`. Validation returns 400; missing records 404; oversized POST 413; per-client analysis limits 429. Requests include `X-Request-ID`. POST bodies are capped at 32 KiB including chunked bodies. Only operator CLI processes may import local files; there is no remote ingestion write API.
