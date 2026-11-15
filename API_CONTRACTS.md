# API contracts

Base URL in development: `http://127.0.0.1:8000`

JSON only. All ids are the strings defined in [DATA_SCHEMA.md](DATA_SCHEMA.md).

The examples in this file illustrate field names. Titles, ids, and passages marked here are structural placeholders, not research results. The live API must not return them.

## Common error

Status `404`, `400`, or `503`.

```json
{
  "error": {
    "code": "paper_not_found",
    "message": "No manifest record uses this paper_id.",
    "paper_id": "ntrs:0"
  }
}
```

Codes:

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `invalid_request` | Body fails validation |
| 404 | `paper_not_found` | Unknown `paper_id` |
| 404 | `chunk_not_found` | Unknown `chunk_id` |
| 404 | `study_not_found` | Unknown `study_id` |
| 503 | `model_unavailable` | Used only if a caller demanded a model and none is configured. The ask route does **not** use this when it can still return passages. |

## `GET /api/health`

`200`

```json
{
  "status": "ok",
  "corpus_version": "0",
  "papers": 0,
  "chunks": 0,
  "retrieval": "keyword",
  "llm_provider": "none"
}
```

`retrieval` is `keyword` or `faiss`. `llm_provider` is `none`, `ollama`, or `openai_compatible`.

## `GET /api/stats`

`200`

```json
{
  "corpus_version": "0",
  "papers": 0,
  "papers_with_text": 0,
  "chunks": 0,
  "studies": 0,
  "verified_measurements": 0,
  "by_source": { "ntrs": 0, "psi": 0 },
  "by_pdf_status": { "downloaded": 0, "metadata_only": 0, "unavailable": 0 },
  "limitations": [
    "Independent research prototype. Not a NASA-endorsed or certified fire-safety system.",
    "Microgravity findings in the corpus are not lunar or Martian predictions."
  ]
}
```

Counts are integer aggregates of on-disk artifacts. `limitations` always includes those two sentences. Agent 6 may append corpus-specific limits after ingestion. They must be true of this corpus.

## `GET /api/papers`

Query: `q`, `source`, `year`, `pdf_status`, `topic`. All optional. `q` matches title, authors, and abstract with a case-insensitive substring. Empty corpus returns `papers: []`, not an error.

`200`

```json
{
  "corpus_version": "0",
  "papers": []
}
```

Each list item includes `paper_id`, `title`, `authors`, `year`, `source`, `official_url`, `pdf_status`, `topics`, `abstract` (truncated to 480 characters in the list).

## `GET /api/papers/{paper_id}`

`200` returns the full manifest record plus:

```json
{
  "page_count": 0,
  "study_ids": []
}
```

`404` with `paper_not_found` when the id is absent.

## `GET /api/evidence/{chunk_id}`

`200`

```json
{
  "chunk_id": "ntrs:0#p1#c1",
  "paper_id": "ntrs:0",
  "title": "",
  "page_number": 1,
  "official_url": "",
  "text": "",
  "corpus_version": "0"
}
```

This is the Passage Lens payload. `text` is the stored chunk, not a model paraphrase.

## `POST /api/ask`

```json
{
  "question": "What oxygen concentrations were reported for the flame-spread tests?",
  "paper_id": null,
  "max_passages": 5
}
```

`paper_id` optional. When set, retrieval is restricted to that paper. `max_passages` is 1–8, default 5.

`answer_mode` is `extractive` when the reported lines are verbatim sentences and no model interpretation was kept. `grounded` means those same verbatim lines are accompanied by an interpretation that passed the number audit. `insufficient` means the gate refused.

`200` when the evidence gate finds support and a model interpretation passes the audit:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000000",
  "corpus_version": "0",
  "answer_mode": "grounded",
  "grade": "reported",
  "question": "",
  "reported": [
    {
      "claim_id": "claim:00000000-0000-4000-8000-000000000000:1",
      "text": "",
      "chunk_id": "ntrs:0#p1#c1",
      "paper_id": "ntrs:0",
      "title": "",
      "page_number": 1,
      "official_url": "",
      "quote": ""
    }
  ],
  "interpretation": [
    {
      "claim_id": "claim:00000000-0000-4000-8000-000000000000:2",
      "text": "",
      "based_on_claim_ids": []
    }
  ],
  "passages": [],
  "insufficient_reason": null
}
```

`200` when the gate fails, or the auditor rejects every claim:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000000",
  "corpus_version": "0",
  "answer_mode": "insufficient",
  "grade": "insufficient",
  "question": "",
  "reported": [],
  "interpretation": [],
  "passages": [],
  "insufficient_reason": "No retrieved passage supports an answer to this question."
}
```

`200` when chunks exist and no model is configured:

```json
{
  "answer_mode": "passages_only",
  "grade": "reported",
  "reported": [],
  "interpretation": [],
  "passages": [],
  "insufficient_reason": null,
  "notice": "A language model is not configured. These are retrieved passages, not a generated answer."
}
```

`passages[]` items use the evidence object shape. In `passages_only`, `grade` stays `reported` only as a retrieval status; the UI must show `notice` and must not present passage text as a model conclusion. If retrieval is empty, `answer_mode` is `insufficient` even when the model is missing.

The citation auditor removes reported claims whose `quote` is not a substring of the retrieved chunk or whose `chunk_id` was not in the retrieved set.

## `GET /api/studies`

`200`

```json
{
  "corpus_version": "0",
  "studies": []
}
```

Each item is the study object plus a nested `measurements` array. Values with `verification_status: needs_review` are included and labeled. They are ineligible for charts.

## `POST /api/compare`

```json
{
  "left_study_id": "ntrs:0#s1",
  "right_study_id": "ntrs:0#s2",
  "measurement_family": null
}
```

`measurement_family` optional. When omitted, the gate compares the intersection of verified families. When the intersection is empty, the result is `not_comparable`.

`200`

```json
{
  "corpus_version": "0",
  "comparability": "not_comparable",
  "chart_allowed": false,
  "matched_measurement_family": null,
  "reasons": [
    {
      "code": "gravity_mismatch",
      "message": "Gravity regimes differ or one regime is not reported."
    }
  ],
  "caveats": [],
  "missing_fields": ["oxygen_mole_fraction"],
  "left": {},
  "right": {},
  "points": []
}
```

`left` and `right` are study objects with measurements. `points` is empty unless `chart_allowed` is true. A point is:

```json
{
  "study_id": "",
  "label": "",
  "value": 0,
  "unit": "",
  "uncertainty": null,
  "page_number": 1,
  "provenance": ""
}
```

The sample `value` of `0` in this document is a schema illustration inside an empty `points` description. The live service omits `points` entirely when no verified pair exists. It never fills a missing measurement with zero.

`404` `study_not_found` if either id is unknown. Comparing a study with itself returns `400` `invalid_request`.

## Frontend obligations

- Render `reported` and `interpretation` in separate regions.
- Render `insufficient` as a refusal, not as a short answer.
- Open `/evidence/{chunk_id}` from a citation. Do not scroll a fake page.
- Hide the chart component unless `chart_allowed` is true.
- Show `missing_fields` and `caveats` in the comparison view whenever they are non-empty.
- Read `NEXT_PUBLIC_API_BASE_URL`. Do not hard-code a tunnel URL.

## CORS

Development CORS allows `http://127.0.0.1:3000` and `http://localhost:3000`.
