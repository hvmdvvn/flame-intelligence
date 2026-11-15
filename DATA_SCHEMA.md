# Data schema

Shared contract for every workstream. Example objects below are shapes. They are not NASA records. Do not copy example titles or numbers into the corpus.

## Identifiers

| Id | Pattern | Rule |
| --- | --- | --- |
| `paper_id` | `ntrs:{ntrs_id}` or `psi:{record_id}` | Native source id only. Never minted for a paper we do not hold. |
| `page_id` | `{paper_id}#p{page_number}` | `page_number` is the 1-based PDF page. |
| `chunk_id` | `{paper_id}#p{page_number}#c{index}` | `index` starts at 1 within the page. |
| `study_id` | `{paper_id}#s{index}` | One paper may contain more than one experiment. |
| `measurement_id` | `{study_id}#m{index}` | One row per reported value. |
| `claim_id` | `claim:{request_id}:{n}` | Runtime only. Not a scientific identifier. |

`request_id` is a UUID created by the ask endpoint.

## Enumerations

`pdf_status`: `downloaded` | `metadata_only` | `unavailable`

`extraction_status`: `extracted` | `partial` | `failed` | `not_attempted`

`verification_status`: `verified` | `needs_review` | `not_reported` | `ambiguous`

`gravity_regime`: `microgravity` | `partial_gravity` | `normal_gravity` | `other` | `not_reported`

`platform`: `iss` | `drop_tower` | `parabolic_aircraft` | `sounding_rocket` | `ground` | `other` | `not_reported`

`claim_grade`: `reported` | `interpretation` | `insufficient`

`comparability`: `comparable` | `comparable_with_caveat` | `not_comparable`

`answer_mode`: `grounded` | `passages_only` | `insufficient`

Fuel family and measurement family are closed lists only after Agent 3 writes them in `backend/data/data_dictionary.md` from papers actually read. Until then each study stores the paper's own wording in `fuel_as_reported` and `measurement_as_reported`, plus `fuel_family: not_reported` or `measurement_family: not_reported` if the analyst has not classified it.

## Paper manifest

File: `backend/data/manifest.json`

```json
{
  "corpus_version": "0",
  "built_at": null,
  "papers": []
}
```

Paper object:

| Field | Required | Notes |
| --- | --- | --- |
| `paper_id` | yes | See identifiers |
| `source` | yes | `ntrs` or `psi` |
| `source_record_id` | yes | Id at the source |
| `title` | yes | Official title |
| `authors` | yes | Array. Empty if the source omitted authors. Do not guess. |
| `year` | yes | Integer or null |
| `abstract` | yes | Official abstract or null |
| `official_url` | yes | Record page, not a search URL |
| `pdf_url` | yes | String or null |
| `pdf_status` | yes | Enumeration |
| `local_pdf_path` | yes | Relative path or null. File is gitignored. |
| `topics` | yes | Subset of the focus topics that a human assigned |
| `extraction_status` | yes | Enumeration |
| `extraction_notes` | yes | Scanned pages, broken order, missing tables |
| `synthetic` | yes | Must be `false` for any real record |

## Page extract

File per paper: `backend/data/extracts/{paper_id}.json` with `:` in the id replaced by `__` on disk (`ntrs__12345.json`). The in-file `paper_id` keeps the colon form.

```json
{
  "paper_id": "ntrs:0000000",
  "extractor": "pymupdf",
  "pages": [
    {
      "page_id": "ntrs:0000000#p1",
      "page_number": 1,
      "text": "",
      "quality_flags": []
    }
  ]
}
```

`quality_flags` values: `header_footer_stripped` | `possible_scan` | `reading_order_suspect` | `table_flattened` | `symbols_uncertain`.

Cleaning may drop repeated running headers. It must not drop units, equations, or table body text to make the page look tidy.

## Chunk

File: `backend/data/chunks.json`

| Field | Required | Notes |
| --- | --- | --- |
| `chunk_id` | yes | |
| `paper_id` | yes | |
| `title` | yes | Denormalized so citations survive without a join |
| `official_url` | yes | |
| `page_number` | yes | |
| `text` | yes | Overlapping window of page text |
| `char_start` | yes | Offset in the cleaned page text |
| `char_end` | yes | |
| `token_estimate` | yes | Rough size used to build the window |

Chunking target: about 800–1200 characters, overlap about 150, cut on paragraph boundaries when possible. Never split a chunk across pages. A short page is one chunk.

## Study

File: `backend/data/studies.json`

```json
{
  "studies": [],
  "measurements": [],
  "comparison_rules_version": "1"
}
```

Study object:

| Field | Required | Notes |
| --- | --- | --- |
| `study_id` | yes | |
| `paper_id` | yes | |
| `label` | yes | Wording from the paper, or `not_reported` |
| `experiment_program` | yes | String or null |
| `fuel_as_reported` | yes | String or null |
| `fuel_family` | yes | Classified or `not_reported` |
| `gravity_regime` | yes | Enumeration |
| `platform` | yes | Enumeration |
| `oxygen_mole_fraction` | yes | Number or null |
| `oxygen_as_reported` | yes | Original phrase or null |
| `pressure_kpa` | yes | Number or null. Null if not reported. Never 0 as a stand-in. |
| `pressure_as_reported` | yes | Original phrase including unit, or null |
| `ambient_gas` | yes | String or null |
| `method` | yes | String or null |
| `limitations` | yes | Array of strings taken from the paper or the analyst's reading notes. Reading notes must be prefixed `analyst:` |
| `provenance` | yes | `{ "page_number", "location" }` where location is `page`, `table:N`, or `figure:N` |

Measurement object:

| Field | Required | Notes |
| --- | --- | --- |
| `measurement_id` | yes | |
| `study_id` | yes | |
| `paper_id` | yes | |
| `measurement_as_reported` | yes | Name in the paper |
| `measurement_family` | yes | Or `not_reported` |
| `value` | yes | Number or null |
| `unit` | yes | Original unit or null |
| `uncertainty` | yes | String or null, only if reported |
| `normalized_value` | yes | Number or null |
| `normalized_unit` | yes | String or null |
| `conversion_note` | yes | Null unless a conversion was applied |
| `verification_status` | yes | Demo charts require `verified` |
| `provenance` | yes | Page plus table or figure |
| `synthetic` | yes | `false` |

If `value` is null, `verification_status` is `not_reported`. Consumers must not coerce null to 0.

## Condition fingerprint

Derived, not hand-waved, by the comparison service from a study:

```json
{
  "study_id": "ntrs:0000000#s1",
  "gravity_regime": "not_reported",
  "platform": "not_reported",
  "fuel_family": "not_reported",
  "measurement_families": [],
  "oxygen_reported": false,
  "pressure_reported": false
}
```

## Claim docket (response, not a corpus file)

See [API_CONTRACTS.md](API_CONTRACTS.md). A reported claim stores `chunk_id`, `paper_id`, `page_number`, `official_url`, and a `quote` copied from that chunk. The quote must be a substring of the chunk text.

## Comparability decision (response)

| Field | Notes |
| --- | --- |
| `comparability` | Enumeration |
| `chart_allowed` | `true` only for `comparable` and `comparable_with_caveat` |
| `matched_measurement_family` | String or null |
| `reasons` | Machine codes plus human sentences |
| `caveats` | Present when oxygen or pressure differs |
| `missing_fields` | Field names that are null or `not_reported` on either study |

Reason codes: `measurement_mismatch` | `unit_mismatch` | `gravity_mismatch` | `fuel_mismatch` | `unverified_value` | `missing_value` | `oxygen_differs` | `pressure_differs` | `definition_unclassified`.

`oxygen_differs` and `pressure_differs` produce a caveat when every hard condition matches. All other codes produce `not_comparable`.

## Versioning

`corpus_version` increments when the manifest changes. Chunk index rebuilds in the same change. Study file changes do not require a chunk rebuild. The API returns `corpus_version` on stats, papers, ask, and compare so the UI can show which snapshot it is reading.
