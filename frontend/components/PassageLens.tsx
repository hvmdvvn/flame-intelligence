"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Failure, Highlighted, Loading } from "@/components/Chrome";
import { PageIntro } from "@/components/ResearchUI";
import { api } from "@/lib/api";
import type { Evidence } from "@/lib/types";
import "@/app/workbench.css";

export function PassageLens({ chunkId, quote }: { chunkId:string; quote:string }) {
  const [evidence,setEvidence]=useState<Evidence | null>(null);
  const [error,setError]=useState<string | null>(null);
  const [revision,setRevision]=useState(0);
  useEffect(() => {const controller=new AbortController();setError(null);
    api<Evidence>(`/api/evidence/${encodeURIComponent(chunkId)}`,{signal:controller.signal}).then(setEvidence).catch((reason:Error) => {if(!controller.signal.aborted) setError(reason.message);});
    return () => controller.abort();
  },[chunkId,revision]);
  if(error) return <Failure message={error} retry={() => setRevision(v => v+1)} />;
  if(!evidence) return <Loading label="Opening the original indexed passage" />;
  return <div className="max-w-5xl mx-auto">
    <PageIntro eyebrow="PASSAGE LENS" title={evidence.title}>The quoted passage is highlighted below. Page references use the PDF page index.</PageIntro>
    <div className="flex flex-wrap gap-3 mb-7"><span className="wb-badge">Indexed publication passage</span><span className="wb-badge">PDF page {evidence.page_number}</span><span className="wb-badge">{evidence.paper_id}</span></div>
    <article aria-label="Original source passage" className="wb-page-text"><Highlighted text={evidence.text} quote={quote} /></article>
    <div className="wb-actions"><a className="primary-button" href={evidence.official_url} target="_blank" rel="noreferrer">Official record <span aria-hidden="true">↗</span></a><Link className="secondary-button" href={`/research/${encodeURIComponent(evidence.paper_id)}`}>View publication <span aria-hidden="true">↗</span></Link><Link className="wb-text-link" href={`/ask?paper=${encodeURIComponent(evidence.paper_id)}`}>Ask about this publication ↗</Link></div>
    <details className="wb-metadata mt-8"><summary className="cursor-pointer font-semibold">Passage identifier and provenance</summary><p className="mt-4 break-all text-mist">{evidence.chunk_id}</p><p className="mt-3 text-mist">Corpus version: {evidence.corpus_version}. Page numbers refer to the PDF page index, which may differ from printed page numbers.</p></details>
  </div>;
}
