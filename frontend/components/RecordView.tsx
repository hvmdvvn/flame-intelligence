"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Failure, Loading } from "@/components/Chrome";
import { api } from "@/lib/api";
import type { PageText, Paper } from "@/lib/types";
import "@/app/discovery.css";

type PublicationRecord = Paper & {metadata_corrections?:unknown[]};

export function RecordView({paperId}:{paperId:string}) {
  const [paper,setPaper]=useState<PublicationRecord|null>(null);
  const [page,setPage]=useState<PageText|null>(null);
  const [pageNumber,setPageNumber]=useState(1);
  const [error,setError]=useState("");
  const [pageError,setPageError]=useState("");
  const [notice,setNotice]=useState("");
  const [revision,setRevision]=useState(0);
  const [pageRevision,setPageRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController(); setPaper(null);setPage(null);setError("");setNotice("");
    api<PublicationRecord>(`/api/papers/${encodeURIComponent(paperId)}`,{signal:controller.signal}).then(payload=>{if(!controller.signal.aborted){setPaper(payload);setPageNumber(1);}}).catch((reason:Error)=>{if(!controller.signal.aborted)setError(reason.message);});
    return()=>controller.abort();
  },[paperId,revision]);
  useEffect(()=>{
    if(!paper?.page_count)return;
    const controller=new AbortController();setPage(null);setPageError("");
    api<PageText>(`/api/papers/${encodeURIComponent(paperId)}/pages/${pageNumber}`,{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setPage(value);}).catch((reason:Error)=>{if(!controller.signal.aborted)setPageError(reason.message);});
    return()=>controller.abort();
  },[paperId,pageNumber,paper?.page_count,pageRevision]);
  if(error&&!paper)return <Failure message={error} retry={()=>setRevision(v=>v+1)}/>;
  if(!paper)return <Loading label="Opening publication metadata and source pages…"/>;
  const citation=`${paper.authors.join(", ")||"Author not available"}. ${paper.year??"Date not available"}. ${paper.title}. NASA Technical Reports Server. ${paper.official_url}`;
  async function copyCitation(){
    try{await navigator.clipboard.writeText(citation);setNotice("Citation copied to clipboard.");}
    catch{setNotice("Clipboard access is unavailable. Select and copy the citation text below.");}
  }
  return <div>
    <Link className="record-breadcrumb" href="/research">← Publication archive</Link>
    <div className="record-hero"><div>{paper.synthetic&&<p className="evidence-badge" data-tone="unavailable">Synthetic fixture / not a NASA record</p>}<p className="eyebrow">{paper.source.toUpperCase()} / {paper.paper_id}</p><h1>{paper.title}</h1><p className="record-authors">{paper.authors.join(", ")||"Authors not supplied by the source."}</p></div>
      <div className="record-actions"><a className="primary-button" href={paper.official_url} target="_blank" rel="noreferrer">Original NASA record ↗</a><Link className="secondary-button" href={`/ask?paper=${encodeURIComponent(paper.paper_id)}`}>Ask this publication →</Link><button className="secondary-button" type="button" onClick={()=>void copyCitation()}>Copy citation</button></div>
    </div>
    <div className="record-layout"><section aria-labelledby="publication-context"><h2 className="section-title" id="publication-context">The publication in context</h2><dl className="record-metadata" style={{marginTop:"1.5rem"}}><Meta label="Publication year" value={paper.year?String(paper.year):"Not available"}/><Meta label="Research center" value={paper.center||"Not available"}/><Meta label="Document type" value={paper.sti_type||"Not available"}/><Meta label="Pages extracted" value={String(paper.page_count??0)}/><Meta label="Document identifier" value={paper.source_record_id||paper.paper_id}/><Meta label="Extraction status" value={paper.extraction_status||"Not available"}/></dl>
      <div className="record-abstract"><h2 className="section-title">Research abstract</h2><p>{paper.abstract||"No abstract was supplied by the source."}</p></div>
      <div className="record-topics">{paper.topics?.map(topic=><Link className="filter-chip" key={topic} href={`/research?topic=${encodeURIComponent(topic)}`}>{topic}<span aria-hidden="true">↗</span></Link>)}</div>
      <div className="record-abstract"><span className="evidence-badge" data-tone="documented">Indexed source text</span><p>Indexed text uses the original source wording and PDF page index.</p>{paper.extraction_notes&&<p>Extraction note: {paper.extraction_notes}</p>}</div>
      <div className="record-abstract"><h2 className="section-title">Citation</h2><p style={{overflowWrap:"anywhere",userSelect:"text"}}>{citation}</p><p className="record-status" role="status">{notice}</p></div>
      {!!paper.metadata_corrections?.length&&<details className="record-abstract"><summary className="cursor-pointer">Inspect bibliographic corrections</summary><p>Original metadata is preserved. These corrections identify their source and prior value.</p><pre className="mt-4 overflow-auto whitespace-pre-wrap break-words text-sm">{JSON.stringify(paper.metadata_corrections,null,2)}</pre></details>}
    </section>
    <section className="record-page" aria-labelledby="extracted-page-heading"><div className="record-page-toolbar"><div><h2 className="eyebrow" id="extracted-page-heading">Extracted page</h2><span className="evidence-badge" data-tone="documented">Source document</span></div><div><button type="button" className="secondary-button" aria-label="Previous extracted page" disabled={pageNumber<=1} onClick={()=>setPageNumber(v=>Math.max(1,v-1))}>← Prev</button><span aria-live="polite">{paper.page_count ? pageNumber : 0} / {paper.page_count??0}</span><button type="button" className="secondary-button" aria-label="Next extracted page" disabled={!paper.page_count||pageNumber>=paper.page_count} onClick={()=>setPageNumber(v=>v+1)}>Next →</button></div></div>
      <p className="record-page-note">Page numbers are 1-based PDF indices. Headers, layout artifacts, and extraction uncertainty may remain in this text.</p>
      {pageError&&<div className="mt-5"><Failure message={pageError} retry={()=>setPageRevision(v=>v+1)}/></div>}
      {paper.page_count ? page ? <>{!!page.quality_flags.length&&<p className="record-page-note">Quality flags: {page.quality_flags.join(" / ")}</p>}<p className="record-page-copy">{page.text||"This page had no extractable text."}</p></> : !pageError&&<div className="mt-6"><Loading label={`Loading extracted page ${pageNumber}…`}/></div> : <p className="record-page-copy">No page text is available in this archive. Use the original NASA record to inspect access options.</p>}
      {paper.pdf_url&&<a href={`${paper.pdf_url}#page=${pageNumber}`} className="discovery-inline-link" target="_blank" rel="noreferrer">Open original PDF at this page <span aria-hidden="true">↗</span></a>}
    </section></div>
  </div>;
}

function Meta({label,value}:{label:string;value:string}){return <div><dt>{label}</dt><dd>{value}</dd></div>;}
