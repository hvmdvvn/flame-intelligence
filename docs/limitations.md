# Current limitations

* No raw PSI scientific file has been downloaded in this change. Registered PSI landing-page metadata/DOIs are distinct from validated imported runs. Authorized offline CSV/TSV/JSON import is implemented; arbitrary spreadsheet, image, video measurement extraction and unattended PSI API ingestion are not.
* Existing NTRS annotations contain four publication values (one observed, three computational), not a training dataset. Conditions, uncertainty and calibration are incomplete. Source metadata tables are preserved as strings and excluded from quantitative inference.
* No evaluated predictive model, fire risk probability, engineering certification or validated partial-gravity extrapolation is available.
* Retrieval uses FTS5 and lexical evidence gating; semantic embeddings, hybrid vector search, automated contradiction resolution and expert-reviewed factual entailment evaluation remain outstanding.
* Optional generation can still introduce qualitative unsupported claims; every interpretation is a hypothesis, with citations/numeric checks that do not prove truth. The provider was not evaluated against an external model in this run unless stated in the verification report.
* Mission scoring is a disclosed heuristic and missing conditions receive zero evidence-similarity credit; scores cannot be interpreted as low safety risk.
* Browser-local mission configurations are not authenticated multiuser workspaces. Imports remain operator processes rather than a durable distributed queue. Job status is persisted; a killed process can leave a processing job requiring an idempotent retry.
* Single-host SQLite, local request limits, deployment images, accessibility conformance and operational performance need environment-specific review. Passing builds/tests alone does not establish production readiness.
* The referenced 2026 challenge identity/video is not independently authenticated by this implementation; educational videos are context only. Historical sources describe their publication era, not current commercial availability.

The platform is independent and is not endorsed by NASA. All source-specific and third-party rights continue to apply.
