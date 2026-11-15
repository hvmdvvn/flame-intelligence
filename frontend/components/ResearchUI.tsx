import Link from "next/link";
import type { Source } from "@/lib/research-types";

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className="page-intro"><p className="eyebrow">{eyebrow}</p>
    <h1 className="page-title">{title}</h1>
    <div className="page-description">{children}</div></div>;
}
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-state-symbol" aria-hidden="true">∅</span><div>{children}</div></div>;
}
export function display(value: unknown): string {
  if (value === null || value === undefined || value === "" || value === "not_reported") return "Not available";
  if (Array.isArray(value)) return value.map(display).join("; ") || "Not available";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/_/g, " ");
}
export function SourceLinks({ ids }: { ids: string[] }) {
  return <div className="flex flex-wrap gap-2">{ids.map(id => <Link className="source-chip" key={id} href={`/sources#${encodeURIComponent(id)}`}><span aria-hidden="true">↗</span>{id}</Link>)}</div>;
}
export function SourceCard({ source }: { source: Source }) {
  const url = source.original_url ?? source.url;
  return <article id={source.source_id} className="source-card">
    <p className="font-mono text-xs text-ember">{source.source_id}</p><h3 className="mt-2 text-lg font-semibold">{source.name}</h3>
    {url && /^https?:\/\//i.test(url) && <a href={url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-ember underline">View original source ↗</a>}
    <dl className="mt-4 grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries({ Organization: source.organization, Identifier: source.identifier ?? source.document_id, DOI: source.doi,
        "Publication date": source.publication_date, "Retrieval status": source.retrieval_status,
        "License / restrictions": source.license ?? source.usage_restrictions }).filter(([key,value]) => key === "License / restrictions" || key === "Retrieval status" || value).map(([key,value]) => <div key={key}>
        <dt className="text-mist">{key}</dt><dd className="mt-1 break-words">{display(value)}</dd></div>)}
    </dl>
    <details className="mt-4 text-xs"><summary className="cursor-pointer text-mist">Access and processing details</summary><dl className="mt-3 grid gap-4 sm:grid-cols-2">
      {Object.entries({ "Last updated": source.update_date, "Access date": source.access_date ?? source.retrieved_at,
        "Dataset version": source.dataset_version, "Content type": source.content_type,
        "Trust classification": source.trust_classification, "Extraction method": source.extraction_method,
        "File checksum": source.checksum ?? source.checksum_sha256 ?? source.sha256 }).map(([key,value]) => <div key={key}><dt className="text-mist">{key}</dt><dd className="mt-1 break-words">{display(value)}</dd></div>)}
    </dl></details>
    {source.passage && <blockquote className="mt-4 border-l-2 border-ember pl-4 text-sm leading-relaxed"><p>{source.passage}</p><p className="mt-2 text-xs text-mist">Source location: {source.source_section ?? "Section unavailable"}</p></blockquote>}
    {!!source.file_checksums?.length && <details className="mt-4 text-xs"><summary className="cursor-pointer text-mist">Verified file checksums</summary><pre className="mt-3 overflow-auto whitespace-pre-wrap">{JSON.stringify(source.file_checksums,null,2)}</pre></details>}
    {!!source.processing_history?.length && <details className="mt-4 text-xs"><summary className="cursor-pointer text-mist">Processing history</summary>
      <pre className="mt-3 overflow-auto whitespace-pre-wrap">{JSON.stringify(source.processing_history, null, 2)}</pre></details>}
  </article>;
}

export function downloadJSON(payload: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
