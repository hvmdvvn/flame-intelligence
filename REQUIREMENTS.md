# Requirements

Extracted from the Flame Intelligence proposal (`NASA Hackathon.pdf`) and the six-member implementation report (`Flame_in_Freefall_Team_Implementation_Assignment_Report.pdf`). Where the two documents differ, the stricter scientific rule wins.

Nothing here is implemented yet.

## Problem

Microgravity combustion research is spread across NASA technical reports and physical-sciences records. A person needs a long time to find a study, read its conditions, and judge whether it can be compared with another study. General-purpose chat tools answer without showing the page.

The product question: how can software make that research easier to discover, understand, compare, and verify while keeping scientific accuracy visible?

## Product

Working local prototype. Curated corpus of about 10–20 official records if they can be accessed. Smaller verified corpus is preferred over a large unverified one.

Users can:

- discover authentic NASA combustion research
- search the curated records
- ask a scientific question and receive an evidence-grounded result
- inspect the supporting passage, paper, page, and official URL
- explore verified experimental measurements
- compare two studies only when the comparison gate allows it
- see missing information, uncertainty, and experimental limits

Users cannot, in this prototype, silently edit findings attributed to NASA.

## Priority

### Must

- Official NASA collection with source URLs and stable `paper_id`
- Page-aware text extraction and a source manifest
- Research search and record detail
- Retrieval over extracted pages
- Answers with citations, or an explicit insufficient-evidence response
- Evidence view: passage, title, page, official link
- One comparison workflow: either a verified comparable pair, or a documented non-comparable pair with a warning and no combined chart
- Dashboard statistics computed from the actual manifest
- Error handling for missing records, missing PDFs, malformed requests, and an unavailable model
- README with setup, architecture pointer, and limitations

### Should

- Filters on the Source Stack (topic, year, platform, PDF status)
- Structured study details and units
- A chart only after `comparable` or `comparable_with_caveat`
- Reported uncertainty when the paper reports it
- Loading, empty, and failure states
- Responsive layout
- At least 15 prepared questions and a citation audit

### Stretch (blocked until the must path works)

- Interactive evidence graph
- Scheduled rediscovery of new NTRS or PSI records
- Researcher notes, stored apart from NASA rows
- Conflict detection beyond the divergence card
- Accuracy percentages (forbidden unless a documented evaluation produced them)

## Functional requirements

### FR-1 Research discovery

The system lists only records present in the manifest. Each card shows title, year, authors when the source provided them, a short abstract or description taken from the source, PDF access status, and the official URL. Filters must not invent facets.

### FR-2 Record detail

Selecting a record shows the stored metadata and the official source link. Fields the source did not provide are shown as not reported.

### FR-3 Corpus statistics

Home statistics are counts and breakdowns from the manifest and the verified study table: records, records with extracted text, verified measurements, studies blocked from comparison. They are not targets dressed up as progress.

### FR-4 Ask

A question returns a claim docket:

- `reported` claims, each bound to a retrieved chunk
- `interpretation` statements, labeled as interpretation
- or a single insufficient-evidence result when the evidence gate fails

The prose must not contain citations the auditor did not accept.

### FR-5 Passage lens

Activating a citation opens the chunk text, `paper_id`, title, page number, and official URL. The page number is the PDF page stored at extraction time.

### FR-6 Comparison

The client sends two `study_id` values. The server returns eligibility, condition fingerprints, measurements, units, missing fields, warnings, and whether a chart is allowed. The client does not decide eligibility.

### FR-7 Insufficient evidence

Questions outside the corpus, including requests for a safety certification, a lunar prediction, or a number no paper reported, return insufficient evidence. The HTTP call still succeeds. The grade carries the refusal.

### FR-8 Failures

Missing paper, missing chunk, malformed body, and model outage return the error shapes in [API_CONTRACTS.md](API_CONTRACTS.md). A model outage still returns retrieved passages when retrieval succeeded.

## Scientific safeguards

1. Do not fabricate NASA records, authors, citations, results, or measurements.
2. Keep the official URL and the original page number.
3. Ground every scientific answer in retrieved research from this corpus.
4. Return insufficient evidence when the retrieved text does not support an answer.
5. Do not store or plot a missing measurement as zero.
6. Do not merge incompatible experiments into one chart.
7. Separate reported findings from model interpretation on the screen.
8. Do not imply NASA endorsement. Copy must say the records come from NASA and the tool is an independent prototype.
9. Do not present the application as a certified spacecraft fire-safety system.
10. Any future placeholder or synthetic row must be labeled `synthetic: true` and cannot appear in demo statistics or charts. The plan does not include synthetic measurements.
11. Do not treat a microgravity result as evidence about the Moon, Mars, or every spacecraft atmosphere.
12. Do not claim a safest fuel or a danger ranking.
13. Abstracts and search snippets are not proof of a numerical result. Demo numbers require `verification_status: verified` and a page, table, or figure reference.
14. Unit conversions keep the original value and unit beside the converted value.
15. Do not publish an accuracy percentage without a documented test method and results.

## Acceptance for the prototype

- A person can open a real NASA record from the Source Stack.
- A prepared question returns a cited claim whose chunk text supports the claim, or a correct insufficient-evidence response.
- The citation opens the Passage Lens.
- Two selected studies either render a verified comparison with units and caveats, or a divergence card that blocks the chart.
- Home counts match the files on disk.
- Backend tests and the journey check have been run and their results recorded in `qa/`.
- External limits (PSI access, unscanned PDFs, missing model key) are written down, not hidden.

## Demo story (about three minutes)

1. Why scattered microgravity combustion research is hard to trust through a generic chat tool.
2. Ask one prepared question. Show reported claims and page citations. Open the Passage Lens.
3. Select two studies. Show the gate, the units, and either the allowed chart or the divergence card.
4. Show The Unsaid: what this corpus does not establish.
5. State the limitation: research navigation prototype, not an operational safety system.

## Future work (out of sprint)

Automated ingestion on a schedule, table extraction review tools, researcher correction flags, a fuller evidence graph, systematic retrieval scoring, and any predictive model only after a real dataset and review exist.
