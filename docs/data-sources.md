# Data sources and retrieval record

Review date: **14 November 2026**. The checked-in `backend/data/research_catalog.json` contains source-backed metadata, not a claim that the listed investigations' experimental files have been ingested. NASA hosting and citations do not constitute NASA endorsement or validation of platform interpretations.

## Sources inspected

| Resource | Actual retrieval outcome and role |
| --- | --- |
| [PSI combustion search](https://psi.nasa.gov/physci/repo/search?q=combustion) | Requested route inaccessible in the browsing tool; the filtered search route and direct landing pages returned no readable body. Official indexed PSI landing-page metadata was retrievable through search. No undocumented API has been assumed. |
| [NASA Glenn Combustion Science](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/) | Readable official overview; archived experiment identity, scientific objectives and ISS facility context. |
| [Researcher's Guide landing page](https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/) and [technical PDF](https://www.nasa.gov/wp-content/uploads/2016/05/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf) | Underlying 56-page PDF inspected. October 2015 edition, landing page published 6 July 2016 and updated 23 May 2024. Historical terminology and research context; schedules in this document are not current status. PDF pages 12-14: droplets; 21-22: solids; 26: detection; 33-34: cool flames; 45: glovebox. |
| [Apollo 1](https://sma.nasa.gov/sma-disciplines/accllp/apollo-1) | Readable official incident and lessons-learned page; cabin-fire and material-control context. |
| [Apollo 13](https://sma.nasa.gov/sma-disciplines/accllp/apollo-13) | Readable official incident and lessons-learned page; oxygen-system explosion, component redesign and process review. Classified separately from cabin fire. |
| [Mir fire](https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/) | Readable historical account published 23 February 2022. Respiratory protection, evacuation and response context. |
| [Fireman's Air Tanks](https://spinoff.nasa.gov/node/9582) | Historical technology-transfer account, originally 1976. No present product availability verified. |
| [Fire Detector](https://spinoff.nasa.gov/node/9407) | Historical technology-transfer account, originally 1978. Performance is reported in that historical source, not a platform certification. |
| [New Technology for the Fire Attire](https://spinoff.nasa.gov/node/9918) | Historical Project FIRES account, originally 1982. Present availability and adoption unverified. |
| [ScienceCasts video](https://www.youtube.com/watch?v=W1oXykoz9zg) | Retrieval failed; retained as an educational link only. No transcript or scientific evidence ingested. |
| [Provided challenge video](https://www.youtube.com/embed/AVuEiKxOpc0?feature=oembed) | Cache miss; title, date and challenge affiliation remain independently unverified. Educational link only. |

Additional official sources include [NASA's PSI research inventory](https://science.nasa.gov/physical-sciences-informatics-psi/nasa-psi-research-opportunity/), [BRE](https://science.nasa.gov/biological-physical/investigations/bre/), [E-FIELD Flames](https://science.nasa.gov/biological-physical/investigations/e-field-flames/), [ACME](https://science.nasa.gov/biological-physical/investigations/acme/), [station combustion overview](https://www.nasa.gov/missions/station/iss-research/studying-combustion-and-fire-safety/), historical [CFI presentation](https://www.nasa.gov/wp-content/uploads/2016/05/nac_heo_overviewtagged.pdf) and [CFI-G paper section 3.6](https://ntrs.nasa.gov/api/citations/20210021781/downloads/JASMAC%20ACME%20paper%2020210921.pdf). Individual catalog entries retain their exact source relationships. BRE uses a gaseous-fuel analogy; it is not a direct solid-material test. E-FIELD primarily addresses terrestrial combustion. CFI and CFI-G represent different experimental configurations.

## PSI metadata actually retrieved

The following identifiers, DOIs, versions and rights declarations were visible in indexed official PSI records. `indexed_metadata` means the original NASA landing page was indexed by the web search provider; this review did not download or checksum the underlying sensor files. DOIs should be used when citing the collections.

| Record | Investigation | Version | DOI | License on record |
| --- | --- | --- | --- | --- |
| [PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25) | BASS-II | 4 | 10.60555/4qc4-de67 | CC0-1.0 |
| [PSI-69](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69) | FLEX | 5 | 10.60555/mbq8-0451 | CC0-1.0 |
| [PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98) | Saffire-I | 4 | 10.60555/0t15-1z43 | CC0-1.0 |
| [PSI-101](https://psi.nasa.gov/physci/repo/data/investigations/PSI-101) | SAME-R | 4 | 10.60555/2np7-jv14 | CC0-1.0 |
| [PSI-62](https://psi.nasa.gov/physci/repo/data/investigations/PSI-62) | Ground flame-spread modeling with BASS imagery | 1 | 10.60555/e9xp-ex83 | CC0-1.0 |

Coverage includes all 18 named target investigations, plus SoFIE and PSI-62. For the remaining targets the metadata is supported by NASA program descriptions or its PSI inventory, without a verified numeric PSI identifier. No identifier is inferred from neighboring numbers. Investigation-level atmosphere values are null because a program does not have one universal oxygen concentration or pressure. A scientific objective is not an observed result.

A five-row BASS-II experimental-table excerpt is preserved as strings in `experimental_table_snapshot`, together with column definitions and the source/version. It is metadata, is not automatically imported as validated measurements, and is excluded from training and numerical comparison. The reported low final-oxygen reading in B2 and negative initial-CO reading in B4 require review; they have not been repaired or silently interpreted. Missing physical airflow calibration, pressure and uncertainty prevent a complete run fingerprint.

PSI-98 contains inconsistent project-period and proposal-title fields relative to its Saffire description. Those fields are not propagated. NASA's ACME overview describes five studies whereas later reviews describe six; the catalog records this historical difference instead of assuming all sources describe the same program date.

## Authorized acquisition and import

Use the official repository interface to select an investigation, read its documentation and rights, and download only permitted files. NASA's [29 September 2025 large-download instructions](https://science.nasa.gov/uncategorized/new-file-download-process-for-large-requestspsi-new-file-download-process/) describe email delivery for requests above 1 GB; the access links expire after seven days. The platform does not request email downloads, authenticate to PSI, or bypass restrictions automatically.

Record original landing-page URL, persistent identifier, collection version, rights, access date and original filename. Retain original downloaded bytes. Extract archives locally with a trusted tool before importing supported tabular files; do not treat archive members as executable instructions. Follow the documented local import CLI and schema in the application README and deployment instructions. Provide a schema mapping for the actual file; no universal PSI CSV schema has been asserted. Import review must preserve volume fraction versus mole fraction versus mass fraction and distinguish partial from total pressure.

This review established no documented public PSI API contract. It also did not establish that every listed investigation has unrestricted raw downloads. Rights for inspected PSI collections cannot be generalized to third-party NASA-hosted papers, images, videos, or every NASA dataset.

## Existing NTRS corpus verification

The original archive has twelve NTRS records. Ten citation pages were retrieved during this audit; two could not be independently reverified. Seven year fields disagree with the explicit NTRS Publication Date and have traceable corrections in the catalog. The original JSON is preserved; the application may apply these corrections as an auditable metadata overlay.

| NTRS record | Original year | Verified publication date |
| --- | --- | --- |
| [20150008962](https://ntrs.nasa.gov/citations/20150008962) | 2019 | 2015-05-17 |
| [20170000230](https://ntrs.nasa.gov/citations/20170000230) | 2019 | 2016-07-10 |
| [19890014267](https://ntrs.nasa.gov/citations/19890014267) | 2019 | 1989-02-01 |
| [20150019858](https://ntrs.nasa.gov/citations/20150019858) | 2019 | 2015-07-12 |
| [20150023456](https://ntrs.nasa.gov/citations/20150023456) | 2019 | 2015-11-01 |
| [20200000361](https://ntrs.nasa.gov/citations/20200000361) | 2020 | 2019-11-20 |
| [20050199458](https://ntrs.nasa.gov/citations/20050199458) | 2018 | 2001-03-01 |

[20210011385](https://ntrs.nasa.gov/citations/20210011385) confirms 2021-10-01. [20205004657](https://ntrs.nasa.gov/citations/20205004657) and [20240007628](https://ntrs.nasa.gov/citations/20240007628) were readable but did not display explicit publication dates, so meeting/acquisition dates are not substituted. [20090014812](https://ntrs.nasa.gov/citations/20090014812) returned 403 and [20260001600](https://ntrs.nasa.gov/citations/20260001600) was inaccessible; their pre-existing extracts are not represented as independently reverified by this review.

No new raw PSI measurements, performance scores or validated predictive model were produced by this source review. The existing NTRS papers remain a separate document-evidence corpus. Local PDF presence and checksum must be checked from local bytes, not inferred from a manifest download status.
