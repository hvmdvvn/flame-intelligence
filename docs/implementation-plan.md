# Implementation plan

1. Preserve the audited Next.js/FastAPI routes, NTRS extracts and study annotations; record baseline checks.
2. Verify supplied NASA sources and create a source-governed investigation catalog, with access status and publication dates. Establish a SQLite scientific schema and repeatable migrations alongside the existing archive.
3. Implement operator-only offline CSV/TSV/JSON scientific imports: immutable originals, checksums, validation, normalization, atomic persistence, job logs, quarantine and idempotency. Raw PSI files require authorized downloads; do not use an undocumented endpoint.
4. Add persisted investigation discovery/detail, source inspection, deterministic mission relevance ranking, condition/coverage gaps, quantitative summaries and downloadable reproducibility reports.
5. Extend the existing frontend with investigation, mission, registry, history/technology-transfer and analytics workflows. All controls must consume real API state or persist user configurations locally.
6. Harden existing retrieval and comparison: retain traceable extracts, distinguish predictions/observations, fail closed on unsafe claims, validate cited structured output and add scientific regression evaluations.
7. Add API limits, structured request logs, readiness, deployment configuration, CI and operations/scientific documentation. Run backend, frontend, scientific integrity and available browser checks. Publish actual outcomes and limitations.

Predictive models stay unavailable until sufficient comparable authentic runs and independent grouped evaluation exist. Semantic embeddings and unsupported formats must remain transparently unavailable unless implemented and exercised. No claim of NASA endorsement or engineering certification is permitted.
