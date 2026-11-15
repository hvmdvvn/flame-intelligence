# Implemented architecture

Next.js presents the existing publication/evidence/comparison workflows and the investigation, mission, analytics and source workspaces. FastAPI serves backward-compatible `/api` endpoints and OpenAPI at `/docs`. SQLite FTS5 retrieves publication passages; a separate SQLite research registry stores attributed source metadata and normalized scientific imports.

`research_store.initialize()` applies ordered `backend/migrations/*.sql` and seeds the catalog without touching the original NTRS manifest. The schema relates investigations → sources → datasets → runs → measurements. JSON metadata preserves future attributes without adding unverified values. Provenance events and ingestion jobs record processing versions and errors.

Original NTRS JSON/PDF artifacts are preserved. Catalog corrections overlay selected bibliographic fields without rewriting the original manifest. Offline import records immutable content-addressed raw files and stores validated original values, normalized values and processing metadata in separate SQLite columns. Derived analytics and reports are computed on demand. AI interpretations remain separate from observations and raw measurements.

Single-host deployment uses Next.js, FastAPI, SQLite and a reverse proxy. No broker, graph database or hosted vector service is required. Imports run as operator processes outside web requests; there is no unauthenticated upload or arbitrary fetch endpoint. SQLite and the per-process rate limiter target one backend worker; multi-host deployment requires shared state, rate limiting and operational review.

See [audit](architecture-audit.md), [API](api.md), and [deployment](deployment.md).
