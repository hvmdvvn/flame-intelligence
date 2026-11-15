# Journey check

Run against the local API and the Next.js bench on 5 Nov 2026.

| Step | Result |
| --- | --- |
| Application loads | Pass. http://127.0.0.1:3000 |
| Dashboard statistics | Pass. 12 records, 12 with page text, 720 passages, 4 verified values, 0 synthetic |
| Archive lists NASA records | Pass. Titles and NTRS links come from the ingest manifest |
| Paper detail | Pass. BASS-II summary, authors, year 2021, Glenn Research Center, page reader 1/70 |
| Scientific question | Pass. Confinement question returned verbatim sentences from `ntrs:20205004657` pages 9, 2, and 7 |
| Citations open the passage | Pass. Page 9 of Effects of Confinement on Flame Spread in Microgravity |
| Unsupported question | Pass. Lunar certification and safest-Mars questions return insufficient evidence |
| Comparison gate | Pass. ISS 2.2 mm/s versus 1g model 2.8 mm/s stays locked (gravity). 1.5 cm/s at 21% oxygen versus 3.5 cm/s at 16% oxygen charts with an oxygen caveat |
| Missing record | Pass. Unknown paper id returns 404 `paper_not_found` |
| Backend tests | 11 passed |

No language model is configured. The docket labels answers as verbatim extracts.

PSI returned HTTP 200 and was not ingested. See `backend/data/EXTRACTION_REPORT.md`.
