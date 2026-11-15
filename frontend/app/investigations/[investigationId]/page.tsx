"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Failure, Loading } from "@/components/Chrome";
import { EmptyState, PageIntro, SourceCard, display, downloadJSON } from "@/components/ResearchUI";
import { api, API_BASE } from "@/lib/api";
import type { Investigation } from "@/lib/research-types";
import "../../discovery.css";

const CONDITION_LABELS:Record<string,string>={oxygen_fraction:"Oxygen fraction",oxygen_fraction_basis:"Oxygen fraction basis",pressure_kpa:"Total pressure (kPa)",airflow_m_s:"Ventilation velocity (m/s)",gas_composition:"Gas composition"};

export default function InvestigationDetail({params}:{params:Promise<{investigationId:string}>}) {
  const {investigationId}=use(params);
  const [data,setData]=useState<Investigation|null>(null);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const controller=new AbortController();setData(null);setError("");api<Investigation>(`/api/investigations/${encodeURIComponent(investigationId)}`,{signal:controller.signal}).then(v=>{if(!controller.signal.aborted)setData(v);}).catch((e:Error)=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[investigationId,revision]);
  return <div className="discovery-page"><Link className="record-breadcrumb" href="/investigations">← Investigation explorer</Link>
    {error&&<Failure message={error} retry={()=>setRevision(v=>v+1)}/>}
    {!data&&!error&&<Loading label="Loading investigation and source provenance…"/>}
    {data&&<><div className="discovery-intro"><PageIntro eyebrow={`Investigation / ${data.investigation_id}`} title={data.name}>{data.full_name}</PageIntro><div className="discovery-intro-note"><span className="evidence-badge" data-tone={data.measurement_count?"observed":"unavailable"}>{data.measurement_count} validated measurements</span><p>{data.datasets.length} imported datasets / {data.source_ids.length} source references</p></div></div>
      <div className="investigation-detail-layout"><div className="investigation-detail-main">
        <section><p className="eyebrow">01 / Purpose</p><h2 className="section-title">Research objective</h2><p>{data.objective||data.summary||"Objective not available from the registered sources."}</p></section>
        <section><p className="eyebrow">02 / Conditions</p><h2 className="section-title">Experimental context</h2><dl className="detail-conditions">{Object.entries({Category:data.category,"Gravity regime":data.gravity_regime,...(data.conditions??{})}).map(([key,value])=><div key={key}><dt>{CONDITION_LABELS[key]??display(key)}</dt><dd>{display(value)}</dd></div>)}</dl><p className="mt-5">An unavailable condition is not zero. Family-level metadata does not describe the conditions of every experimental run.</p></section>
        <section><p className="eyebrow">03 / Available data</p><h2 className="section-title">Datasets and measurements</h2><p className="mb-5">{data.measurement_count} validated measurements across {data.datasets.length} imported datasets.</p>{data.datasets.length===0?<EmptyState>No authenticated experimental files have been imported for this investigation. Inspect the original source for access instructions; this catalog entry supplies no raw numerical observations.</EmptyState>:data.datasets.map(d=><details className="detail-dataset" key={d.dataset_id}><summary>{d.name??d.filename??d.dataset_id}</summary><dl>{Object.entries(d).map(([key,value])=><div key={key}><dt>{display(key)}</dt><dd>{display(value)}</dd></div>)}</dl>{d.download_available?<a className="discovery-inline-link" href={`${API_BASE}/api/datasets/${encodeURIComponent(d.dataset_id)}/download`}>Download authorized original file ↗</a>:<p className="mt-4">Redistribution is not authorized for this file. Use the original source access workflow.</p>}</details>)}</section>
        {!!data.available_files?.length&&<section><h2 className="section-title">Files listed by the repository</h2><p>Listed files have not been downloaded or validated by this platform.</p><ul className="detail-file-list">{data.available_files.map((file,index)=><li key={index}><p>{file.name??"Repository file"}</p><p>Status: {display(file.retrieval_status)}</p>{file.url&&/^https?:\/\//.test(file.url)&&<a className="discovery-inline-link" href={file.url} target="_blank" rel="noreferrer">Open repository access page ↗</a>}</li>)}</ul></section>}
        {!!data.publications?.length&&<section><h2 className="section-title">Related publications</h2><ul>{data.publications.map((publication,index)=><li key={index}>{publication.paper_id?<Link className="discovery-inline-link" href={`/research/${encodeURIComponent(publication.paper_id)}`}>{publication.name??publication.paper_id} ↗</Link>:publication.url&&/^https?:\/\//.test(publication.url)?<a className="discovery-inline-link" href={publication.url} target="_blank" rel="noreferrer">{publication.name??"Source publication"} ↗</a>:<span>{publication.name??"Publication identifier unavailable"}</span>}</li>)}</ul></section>}
      </div><aside className="investigation-aside"><section><span className="evidence-badge" data-tone="unavailable">Applicability has limits</span><h2 className="section-title mt-4">Study limitations</h2><ul>{data.limitations.map(line=><li key={line}>{line}</li>)}</ul></section><section><p className="eyebrow">Related tools</p><h2 className="section-title mt-4">Continue research</h2><div className="mt-4 grid gap-2"><Link className="discovery-inline-link" href={`/ask?q=${encodeURIComponent(`What evidence does the corpus contain about ${data.name}?`)}`}>Retrieve publication evidence ↗</Link><Link className="discovery-inline-link" href={`/missions?q=${encodeURIComponent(data.name)}`}>Evaluate mission relevance ↗</Link><button className="secondary-button mt-4" type="button" onClick={()=>downloadJSON(data,`${data.investigation_id}-metadata.json`)}>Export metadata and provenance</button></div></section></aside></div>
      <section className="detail-source-section"><p className="eyebrow">04 / Provenance</p><h2 className="section-title">Source evidence</h2><div className="grid gap-5">{data.sources?.length?data.sources.map(source=><SourceCard key={source.source_id} source={source}/>):<EmptyState>No source objects were supplied. <Link href="/sources" className="underline">Inspect the source registry.</Link></EmptyState>}</div></section>
    </>}
  </div>;
}
