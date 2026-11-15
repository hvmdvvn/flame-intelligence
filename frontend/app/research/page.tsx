"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Failure, Loading } from "@/components/Chrome";
import { EmptyState, PageIntro } from "@/components/ResearchUI";
import { api } from "@/lib/api";
import type { Paper } from "@/lib/types";
import "../discovery.css";

type ArchiveFilters = {q:string;year:string;source:string;topic:string;sort:string;page:number};
const INITIAL:ArchiveFilters={q:"",year:"",source:"",topic:"",sort:"newest",page:1};
const PER_PAGE=6;

export default function ResearchPage() {
  const [filters,setFilters]=useState<ArchiveFilters>(INITIAL);
  const [input,setInput]=useState("");
  const [ready,setReady]=useState(false);
  const [papers,setPapers]=useState<Paper[]|null>(null);
  const [catalog,setCatalog]=useState<Paper[]>([]);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  useEffect(() => {
    const restore=() => { const p=new URLSearchParams(window.location.search); const values={q:(p.get("q")??"").slice(0,200),year:/^\d{4}$/.test(p.get("year")??"") ? p.get("year")! : "",source:p.get("source")??"",topic:p.get("topic")??"",sort:["newest","oldest","title"].includes(p.get("sort")??"") ? p.get("sort")! : "newest",page:Math.max(1,Math.floor(Number(p.get("page"))||1))}; setFilters(values); setInput(values.q); setReady(true); };
    restore(); window.addEventListener("popstate",restore); return () => window.removeEventListener("popstate",restore);
  },[]);
  useEffect(() => {
    const controller=new AbortController(); api<{papers:Paper[]}>("/api/papers",{signal:controller.signal}).then(v => setCatalog(v.papers)).catch(()=>{}); return () => controller.abort();
  },[revision]);
  useEffect(() => {
    if(!ready) return;
    const params=new URLSearchParams();
    for(const key of ["q","year","source","topic"] as const) if(filters[key]) params.set(key,filters[key]);
    const controller=new AbortController(); setError(""); setPapers(null);
    api<{papers:Paper[]}>(`/api/papers?${params}`,{signal:controller.signal}).then(v => { if(!controller.signal.aborted) setPapers(v.papers); }).catch((e:Error) => { if(!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  },[filters.q,filters.year,filters.source,filters.topic,ready,revision]);
  useEffect(() => {
    if(!ready) return;
    const p=new URLSearchParams(); Object.entries(filters).forEach(([key,value])=>{ if(value!==INITIAL[key as keyof ArchiveFilters]) p.set(key,String(value)); });
    window.history.replaceState(null,"",`${window.location.pathname}${p.size ? `?${p}` : ""}`);
  },[filters,ready]);
  const sorted=useMemo(()=> [...(papers??[])].sort((a,b)=> filters.sort==="title" ? a.title.localeCompare(b.title) : filters.sort==="oldest" ? (a.year??9999)-(b.year??9999) || a.title.localeCompare(b.title) : (b.year??0)-(a.year??0) || a.title.localeCompare(b.title)),[papers,filters.sort]);
  const pages=Math.max(1,Math.ceil(sorted.length/PER_PAGE));
  const page=Math.min(filters.page,pages);
  const visible=sorted.slice((page-1)*PER_PAGE,page*PER_PAGE);
  const years=[...new Set(catalog.map(p=>p.year).filter((year):year is number=>year!==null))].sort((a,b)=>b-a);
  const sources=[...new Set(catalog.map(p=>p.source))].sort();
  const topics=[...new Set(catalog.flatMap(p=>p.topics??[]))].sort();
  const hasFilters=Boolean(filters.q||filters.year||filters.source||filters.topic);
  function change(patch:Partial<ArchiveFilters>) { setFilters(v=>({...v,...patch,page:patch.page??1})); }
  function reset() {setInput("");setFilters(INITIAL);}
  return <div className="discovery-page">
    <div className="discovery-intro"><PageIntro eyebrow="NASA research archive" title="Publications">
      Search titles, authors, and abstracts. Open a publication to read its indexed pages or visit the original NASA record.
    </PageIntro></div>
    <section className="discovery-search-area" aria-label="Publication search and filters"><form className="publication-tools" onSubmit={e=>{e.preventDefault();change({q:input.trim()});}}>
      <label className="discovery-search"><span className="sr-only">Search titles, authors, and abstracts</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input value={input} maxLength={200} placeholder="Search titles, authors, or a research question" onChange={e=>setInput(e.target.value)} />{input&&<button type="button" aria-label="Clear publication search" onClick={()=>{setInput("");change({q:""});}}>×</button>}</label>
      <button type="submit" className="primary-button">Search archive <span aria-hidden="true">↗</span></button>
    </form><div className="publication-filters">
      <label className="field-label">Publication year<select className="field-input" value={filters.year} onChange={e=>change({year:e.target.value})}><option value="">All recorded years</option>{years.map(y=><option value={y} key={y}>{y}</option>)}</select></label>
      <label className="field-label">Source repository<select className="field-input" value={filters.source} onChange={e=>change({source:e.target.value})}><option value="">All repositories</option>{sources.map(s=><option value={s} key={s}>{s.toUpperCase()}</option>)}</select></label>
      <label className="field-label">Research topic<select className="field-input" value={filters.topic} onChange={e=>change({topic:e.target.value})}><option value="">All indexed topics</option>{filters.topic&&!topics.includes(filters.topic)&&<option value={filters.topic}>{filters.topic}</option>}{topics.map(t=><option value={t} key={t}>{t}</option>)}</select></label>
      <label className="field-label">Sort publications<select className="field-input" value={filters.sort} onChange={e=>change({sort:e.target.value})}><option value="newest">Newest publication first</option><option value="oldest">Oldest publication first</option><option value="title">Title A-Z</option></select></label>
    </div>{hasFilters&&<div className="filter-chip-row" aria-label="Active publication filters">{(["q","year","source","topic"] as const).filter(key=>filters[key]).map(key=><button type="button" key={key} className="filter-chip" onClick={()=>{change({[key]:""});if(key==="q")setInput("");}}>{key==="q"?"Search":key}: {filters[key]} <span aria-hidden="true">×</span></button>)}<button type="button" className="text-button" onClick={reset}>Reset filters</button></div>}</section>
    <div className="discovery-results-bar"><p role="status" aria-live="polite">{papers ? `${papers.length} source records` : "Opening the publication archive…"}</p></div>
    {error&&<Failure message={error} retry={()=>setRevision(v=>v+1)}/>}
    {!papers&&!error&&<Loading label="Loading NASA publication records…"/>}
    {papers?.length===0&&<EmptyState><h2 className="section-title">No record matches this search.</h2><p>Try a broader phrase such as “flame”, “oxygen”, or an investigation acronym.</p><button type="button" className="secondary-button" onClick={reset}>Reset filters</button></EmptyState>}
    <ol className="publication-list">{visible.map(paper=><li key={paper.paper_id}><article className="publication-row"><p className="publication-year">{paper.year??"Undated"}</p><div><div className="publication-row-meta" style={{marginTop:0,marginBottom:"1rem"}}><span className="evidence-badge">{paper.source.toUpperCase()}</span><span className="evidence-badge" data-tone="documented">{paper.extraction_status==="extracted" ? "Indexed passages" : "Metadata available"}</span>{paper.synthetic&&<span className="evidence-badge" data-tone="unavailable">Synthetic fixture</span>}</div><h2><Link href={`/research/${encodeURIComponent(paper.paper_id)}`}>{paper.title}</Link></h2><p className="publication-authors">{paper.authors.slice(0,4).join(", ")||"Authors unavailable from the source"}{paper.authors.length>4?" et al.":""}</p><p className="publication-abstract">{paper.abstract||"No abstract supplied. Open the publication for available details."}</p><div className="publication-row-meta"><span>{paper.paper_id}</span><span>{paper.center||"Research center not available"}</span><a className="text-ember underline underline-offset-4" href={paper.official_url} target="_blank" rel="noreferrer">Original record ↗</a></div></div><Link className="publication-row-arrow" aria-label={`Open publication: ${paper.title}`} href={`/research/${encodeURIComponent(paper.paper_id)}`}>↗</Link></article></li>)}</ol>
    {!!papers?.length&&<nav className="discovery-pagination" aria-label="Publication pages"><button type="button" className="secondary-button" disabled={page<=1} onClick={()=>change({page:page-1})}>← Previous</button><span>Page {page} of {pages} / {papers.length} records</span><button type="button" className="secondary-button" disabled={page>=pages} onClick={()=>change({page:page+1})}>Next →</button></nav>}
  </div>;
}
