"""Download a small public NTRS corpus and extract page text.

This script never invents a record. A paper enters the manifest only after NTRS
returns it and a PDF is saved. PSI is probed and recorded; it is not scraped
into fake rows.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

import httpx

from app.config import NTRS_API, USER_AGENT, data_dir
from app.corpus import disk_stem, now_iso, rebuild_chunks

HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/json"}
QUERIES = (
    "microgravity flame spread",
    "Saffire spacecraft fire safety",
    "flame extinction microgravity oxygen",
    "BASS burning suppression solids ISS",
    "FLEX droplet combustion microgravity",
    "solid fuel ignition extinction microgravity",
    "confined concurrent flame spread microgravity",
    "spacecraft fire experiment microgravity",
)
MAX_PAPERS = 12
PER_QUERY = 2
MAX_PAGES = 70
FOCUS = re.compile(r"flame|fire|combust|ignition|extinction|flammab|saffire|burn", re.IGNORECASE)
OFF_TOPIC = re.compile(r"wildfire|forest fire|bushfire", re.IGNORECASE)
ON_ORBIT = re.compile(r"microgravity|spacecraft|reduced gravity|zero gravity|iss\b", re.IGNORECASE)


def absolute(link: str) -> str:
    if link.startswith("http://") or link.startswith("https://"):
        return link
    return NTRS_API + (link if link.startswith("/") else "/" + link)


def year_of(item: dict) -> int | None:
    # Publication date differs from repository acquisition/distribution dates.
    for key in ("publicationDate",):
        value = item.get(key)
        if isinstance(value, str) and len(value) >= 4 and value[:4].isdigit():
            return int(value[:4])
    return None


def authors_of(item: dict) -> list[str]:
    names = []
    affiliations = sorted(item.get("authorAffiliations") or [], key=lambda row: row.get("sequence") or 0)
    for row in affiliations:
        name = ((row.get("meta") or {}).get("author") or {}).get("name")
        if isinstance(name, str) and name.strip() and name.strip() not in names:
            names.append(name.strip())
    return names


def pdf_link(item: dict) -> str | None:
    for download in item.get("downloads") or []:
        if download.get("draft"):
            continue
        links = download.get("links") or {}
        link = links.get("pdf") or links.get("original")
        name = str(download.get("name") or "")
        mime = str(download.get("mimetype") or "")
        if not link:
            continue
        if "pdf" in mime.lower() or name.lower().endswith(".pdf") or str(link).lower().endswith(".pdf"):
            return absolute(str(link))
    return None


def blob_of(item: dict) -> str:
    keywords = " ".join(item.get("keywords") or [])
    return " ".join([str(item.get("title") or ""), str(item.get("abstract") or ""), keywords])


def eligible(item: dict) -> str | None:
    if item.get("distribution") not in (None, "PUBLIC"):
        return "not public"
    if str(item.get("stiType") or "").upper() in {"VIDEO", "AUDIO", "IMAGE"}:
        return "media record"
    blob = blob_of(item)
    if not FOCUS.search(blob):
        return "outside combustion focus"
    if OFF_TOPIC.search(blob) and not ON_ORBIT.search(blob):
        return "terrestrial wildfire record"
    if not pdf_link(item):
        return "no public pdf"
    if not item.get("id") or not item.get("title"):
        return "missing id or title"
    return None


def unwrap(raw: str) -> tuple[str, bool]:
    text = raw.replace("\x00", "").replace("\r", "")
    dehyphenated = False
    paragraphs = re.split(r"\n\s*\n", text)
    cleaned = []
    for paragraph in paragraphs:
        if re.search(r"-\n\s*[A-Za-z]", paragraph):
            dehyphenated = True
            paragraph = re.sub(r"-\n\s*", "", paragraph)
        cleaned.append(re.sub(r"\s*\n\s*", " ", paragraph).strip())
    joined = "\n\n".join(part for part in cleaned if part)
    joined = re.sub(r"[ \t]{2,}", " ", joined)
    return joined.strip(), dehyphenated


def page_flags(raw: str, cleaned: str, dehyphenated: bool) -> list[str]:
    flags = []
    if dehyphenated:
        flags.append("dehyphenated")
    if len(cleaned) < 40:
        flags.append("possible_scan")
    words = re.findall(r"[A-Za-z]{2,}", cleaned)
    if words and sum(len(word) for word in words) / len(words) > 18:
        flags.append("possible_missing_spaces")
    if cleaned.count("\ufffd") > 2:
        flags.append("symbols_uncertain")
    if raw == cleaned:
        pass
    return flags


def extract_pdf(pdf_path: Path, paper_id: str) -> dict:
    import fitz

    document = fitz.open(pdf_path)
    pages = []
    truncated = document.page_count > MAX_PAGES
    try:
        for number in range(1, min(document.page_count, MAX_PAGES) + 1):
            raw = document[number - 1].get_text("text") or ""
            cleaned, dehyphenated = unwrap(raw)
            pages.append(
                {
                    "page_id": f"{paper_id}#p{number}",
                    "page_number": number,
                    "text": cleaned,
                    "quality_flags": page_flags(raw, cleaned, dehyphenated),
                }
            )
    finally:
        document.close()
    return {"paper_id": paper_id, "extractor": "pymupdf", "truncated": truncated, "pages": pages}


def probe_psi(client: httpx.Client) -> str:
    url = "https://psi.nasa.gov/physci/repo"
    try:
        response = client.get(url, timeout=25)
    except Exception as exc:
        return (
            f"PSI at {url} could not be reached ({exc.__class__.__name__}). "
            "No PSI record was invented."
        )
    return (
        f"PSI repository page returned HTTP {response.status_code} ({response.url}). "
        "No stable public document API was used, so this corpus contains NTRS records only. "
        "No PSI metadata was guessed."
    )


def search(client: httpx.Client, query: str) -> list[dict]:
    response = client.get(
        f"{NTRS_API}/api/citations/search",
        params={"q": query, "page.size": 20, "distribution": "PUBLIC"},
        timeout=60,
    )
    response.raise_for_status()
    return response.json().get("results") or []


def download(client: httpx.Client, url: str, dest: Path) -> None:
    from urllib.parse import urlparse
    import hashlib
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "ntrs.nasa.gov":
        raise ValueError("Only official NTRS HTTPS downloads are permitted")
    dest.parent.mkdir(parents=True, exist_ok=True)
    temporary = dest.with_suffix(".part")
    with client.stream("GET", url, timeout=180) as response:
        response.raise_for_status()
        if urlparse(str(response.url)).hostname != "ntrs.nasa.gov":
            raise ValueError("Download redirected outside official NTRS host")
        with temporary.open("wb") as handle:
            size = 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > 100 * 1024 * 1024:
                    raise ValueError("NTRS PDF exceeds 100 MiB operator limit")
                handle.write(chunk)
    if temporary.stat().st_size < 1000 or temporary.read_bytes()[:5] != b"%PDF-":
        temporary.unlink(missing_ok=True)
        raise RuntimeError("download was not a PDF")
    temporary.replace(dest)


def topics_of(item: dict) -> list[str]:
    topics = []
    for keyword in item.get("keywords") or []:
        text = str(keyword).strip().lower()
        if text and text not in topics:
            topics.append(text)
        if len(topics) >= 12:
            break
    return topics


def build() -> dict:
    from app.corpus import load_manifest
    import hashlib
    root = data_dir()
    raw_dir = root / "raw"
    extract_dir = root / "extracts"
    extract_dir.mkdir(parents=True, exist_ok=True)
    log = {"queries": list(QUERIES), "selected": [], "skipped": [], "psi": ""}
    previous = load_manifest()
    papers = []
    seen = set()
    with httpx.Client(headers=HEADERS, follow_redirects=True) as client:
        log["psi"] = probe_psi(client)
        for query in QUERIES:
            if len(papers) >= MAX_PAPERS:
                break
            try:
                results = search(client, query)
            except Exception as exc:
                log["skipped"].append({"query": query, "reason": f"search failed: {exc}"})
                continue
            taken = 0
            for item in results:
                if len(papers) >= MAX_PAPERS or taken >= PER_QUERY:
                    break
                record_id = str(item.get("id"))
                if record_id in seen:
                    continue
                reason = eligible(item)
                if reason:
                    continue
                seen.add(record_id)
                paper_id = f"ntrs:{record_id}"
                link = pdf_link(item)
                dest = raw_dir / f"{disk_stem(paper_id)}.pdf"
                try:
                    if not dest.exists():
                        download(client, link, dest)
                        time.sleep(0.35)
                    extracted = extract_pdf(dest, paper_id)
                except Exception as exc:
                    log["skipped"].append({"id": record_id, "title": item.get("title"), "reason": str(exc)})
                    # Preserve original files even if a newer parser fails.
                    continue
                usable = sum(1 for page in extracted["pages"] if len(page["text"]) >= 80)
                if usable == 0:
                    log["skipped"].append(
                        {"id": record_id, "title": item.get("title"), "reason": "no extractable text (likely scanned)"}
                    )
                    continue
                notes = []
                if extracted["truncated"]:
                    notes.append(f"text extraction stopped at {MAX_PAGES} pages")
                flagged = sum(1 for page in extracted["pages"] if "possible_scan" in page["quality_flags"])
                if flagged:
                    notes.append(f"{flagged} pages flagged as possible scans")
                center = (item.get("center") or {}).get("name")
                paper = {
                    "paper_id": paper_id,
                    "source": "ntrs",
                    "source_record_id": record_id,
                    "title": str(item["title"]).strip(),
                    "authors": authors_of(item),
                    "year": year_of(item),
                    "abstract": item.get("abstract") or None,
                    "official_url": f"https://ntrs.nasa.gov/citations/{record_id}",
                    "pdf_url": link,
                    "pdf_status": "downloaded",
                    "local_pdf_path": str(dest.relative_to(root)).replace("\\", "/"),
                    "topics": topics_of(item),
                    "extraction_status": "extracted" if usable else "partial",
                    "extraction_notes": "; ".join(notes),
                    "synthetic": False,
                    "publication_date": item.get("publicationDate"),
                    "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
                    "center": center,
                    "sti_type": item.get("stiType"),
                }
                (extract_dir / f"{disk_stem(paper_id)}.json").write_text(
                    json.dumps(extracted, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8",
                )
                papers.append(paper)
                taken += 1
                log["selected"].append({"paper_id": paper_id, "title": paper["title"], "query": query})
                print(f"kept {paper_id}: {paper['title'][:80]}", flush=True)
    # An outage or partial search must never remove previously ingested records.
    merged = {p["paper_id"]: p for p in previous.get("papers", [])}
    merged.update({p["paper_id"]: p for p in papers})
    papers = list(merged.values())
    if not papers:
        raise RuntimeError("No records retrieved; existing corpus was not changed")
    manifest = {
        "corpus_version": now_iso(),
        "built_at": now_iso(),
        "limitations": [
            log["psi"],
            "Running headers and footers may remain in extracted page text.",
            "Pages flagged possible_missing_spaces are stored for reading and excluded from retrieval.",
            "Verified comparison rows are entered only after a page check. Ingest does not invent measurements.",
        ],
        "papers": papers,
    }
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    studies = root / "studies.json"
    if not studies.exists():
        studies.write_text(
            json.dumps({"studies": [], "measurements": [], "comparison_rules_version": "1"}, indent=2) + "\n",
            encoding="utf-8",
        )
    chunks = rebuild_chunks()
    report = [
        "# Extraction report",
        "",
        f"Built: {manifest['built_at']}",
        f"Papers kept: {len(papers)}",
        f"Chunks indexed: {chunks}",
        "",
        "## PSI",
        "",
        log["psi"],
        "",
        "## Selected NTRS records",
        "",
    ]
    for paper in papers:
        report.append(f"- {paper['paper_id']} — {paper['title']} ({paper['official_url']})")
    report.extend(["", "## Skipped", ""])
    if not log["skipped"]:
        report.append("No download or extraction failures were recorded.")
    for row in log["skipped"]:
        report.append(f"- {row}")
    report.extend(
        [
            "",
            "## Method",
            "",
            "Records come from the public NTRS citation search. PDFs were saved unchanged under data/raw.",
            "Page text was extracted with PyMuPDF. A page number is the PDF page index, starting at 1.",
            "No author, year, abstract, or measurement was filled from memory.",
            "",
        ]
    )
    (root / "EXTRACTION_REPORT.md").write_text("\n".join(report), encoding="utf-8")
    (root / "INGEST_LOG.json").write_text(json.dumps(log, indent=2) + "\n", encoding="utf-8")
    print(f"done papers={len(papers)} chunks={chunks}", flush=True)
    return manifest


if __name__ == "__main__":
    build()
