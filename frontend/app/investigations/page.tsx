"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Failure, Loading } from "@/components/Chrome";
import { EmptyState, PageIntro, SourceLinks, display } from "@/components/ResearchUI";
import { api } from "@/lib/api";
import type { Investigation, InvestigationList } from "@/lib/research-types";
import "../discovery.css";

type Filters = { q: string; category: string; gravity: string; sort: string; offset: number; view: "cards" | "table" };
const DEFAULTS: Filters = { q: "", category: "", gravity: "", sort: "name", offset: 0, view: "cards" };

function readFilters(): Filters {
  const params = new URLSearchParams(window.location.search);
  return { q: (params.get("q") ?? "").slice(0,200), category: params.get("category") ?? "", gravity: params.get("gravity") ?? "",
    sort: params.get("sort") === "measurements" ? "measurements" : "name", offset: Math.max(0,Number(params.get("offset")) || 0), view: params.get("view") === "table" ? "table" : "cards" };
}

export default function InvestigationsPage() {
  const [filters,setFilters] = useState<Filters>(DEFAULTS);
  const [ready,setReady] = useState(false);
  const [draft,setDraft] = useState({category:"",gravity:"",sort:"name"});
  const [mobileFilters,setMobileFilters] = useState(false);
  const [isMobile,setIsMobile] = useState(false);
  const [result,setResult] = useState<InvestigationList | null>(null);
  const [catalog,setCatalog] = useState<Investigation[]>([]);
  const [selected,setSelected] = useState<Investigation[]>([]);
  const [error,setError] = useState("");
  const [revision,setRevision] = useState(0);
  const comparison = useRef<HTMLElement>(null);

  useEffect(() => {
    const restore = () => { const next=readFilters(); setFilters(next); setDraft(next); setReady(true); };
    const media=window.matchMedia("(max-width: 767px)");
    const screen=() => setIsMobile(media.matches);
    restore(); screen(); window.addEventListener("popstate",restore); media.addEventListener("change",screen);
    return () => { window.removeEventListener("popstate",restore); media.removeEventListener("change",screen); };
  }, []);
  useEffect(() => {
    const controller=new AbortController();
    api<InvestigationList>("/api/investigations?limit=200",{signal:controller.signal}).then(v => setCatalog(v.investigations)).catch(() => {});
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if(!ready) return;
    const params=new URLSearchParams();
    Object.entries(filters).forEach(([key,value]) => { if(value!==DEFAULTS[key as keyof Filters]) params.set(key,String(value)); });
    window.history.replaceState(null,"",`${window.location.pathname}${params.size ? `?${params}` : ""}`);
    const controller=new AbortController();
    const timer=window.setTimeout(() => {
      setError(""); setResult(null);
      const query=new URLSearchParams({q:filters.q,category:filters.category,gravity:filters.gravity,limit:"50",offset:String(filters.offset)});
      api<InvestigationList>(`/api/investigations?${query}`,{signal:controller.signal}).then(v => { if(!controller.signal.aborted) setResult(v); }).catch((e:Error) => { if(!controller.signal.aborted) setError(e.message); });
    },250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filters.q,filters.category,filters.gravity,filters.offset,ready,revision]);
  useEffect(() => {
    if(!ready) return;
    const params=new URLSearchParams(window.location.search);
    if(filters.sort!=="name") params.set("sort",filters.sort); else params.delete("sort");
    if(filters.view!=="cards") params.set("view",filters.view); else params.delete("view");
    window.history.replaceState(null,"",`${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, [filters.sort,filters.view,ready]);
  const records=useMemo(() => [...(result?.investigations ?? [])].sort((a,b) => filters.sort==="measurements" ? b.measurement_count-a.measurement_count || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)),[result,filters.sort]);
  const categories=[...new Set(catalog.map(i => i.category).filter((c):c is string => Boolean(c)))].sort();
  const gravities=[...new Set(catalog.map(i => i.gravity_regime).filter((g):g is string => Boolean(g)))].sort();
  const activeCount=Number(Boolean(filters.q))+Number(Boolean(filters.category))+Number(Boolean(filters.gravity));
  function update(patch:Partial<Filters>) { setFilters(v => ({...v,...patch,offset:patch.offset ?? 0})); }
  function reset() { setFilters(DEFAULTS); setDraft(DEFAULTS); }
  function choose(inv:Investigation,checked:boolean) { setSelected(v => checked ? v.length<4 ? [...v,inv] : v : v.filter(i => i.investigation_id!==inv.investigation_id)); }
  function filterValue(key:"category"|"gravity"|"sort",value:string) {
    if(isMobile) setDraft(v => ({...v,[key]:value})); else { update({[key]:value}); setDraft(v => ({...v,[key]:value})); }
  }
  function focusComparison() {
    comparison.current?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",block:"start"});
    comparison.current?.focus({preventScroll:true});
  }
  return <div className="discovery-page">
    <div className="discovery-intro"><PageIntro eyebrow="Research catalog" title="Investigations">
      Find experiments on flame spread, fuels, and fire detection. Filter by topic or gravity, or select up to four investigations to compare.
    </PageIntro><p className="discovery-intro-note"><span className="evidence-badge">Catalog metadata</span>Measurement counts include validated data only.</p></div>

    <section className="discovery-search-area" aria-label="Investigation search and filters">
      <div className="discovery-search-row"><label className="discovery-search"><span className="sr-only">Search investigations</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        <input value={filters.q} maxLength={200} placeholder="Search a question, acronym, or research topic" onChange={e => update({q:e.target.value})} />
        {filters.q && <button type="button" aria-label="Clear investigation search" onClick={() => update({q:""})}>×</button>}</label>
        <button type="button" className="secondary-button mobile-filter-toggle" aria-controls="investigation-filters" aria-expanded={mobileFilters} onClick={() => { setDraft(filters); setMobileFilters(v => !v); }}>Filters {activeCount ? `(${activeCount})` : ""}<span aria-hidden="true"> ↗</span></button>
      </div>
      <div id="investigation-filters" className={`discovery-filters ${mobileFilters ? "is-open" : ""}`}>
        <label className="field-label">Research category<select className="field-input" value={isMobile ? draft.category : filters.category} onChange={e => filterValue("category",e.target.value)}><option value="">All research categories</option>{categories.map(c => <option key={c} value={c}>{display(c)}</option>)}</select></label>
        <label className="field-label">Gravity regime<select className="field-input" value={isMobile ? draft.gravity : filters.gravity} onChange={e => filterValue("gravity",e.target.value)}><option value="">All documented regimes</option>{gravities.map(g => <option key={g} value={g}>{display(g)}</option>)}</select></label>
        <label className="field-label">Sort this page<select className="field-input" value={isMobile ? draft.sort : filters.sort} onChange={e => filterValue("sort",e.target.value)}><option value="name">Investigation name</option><option value="measurements">Measurement availability</option></select></label>
        <button type="button" className="primary-button mobile-filter-apply" onClick={() => { update(draft); setMobileFilters(false); }}>Apply filters →</button>
      </div>
      {activeCount>0 && <div className="filter-chip-row" aria-label="Active investigation filters">
        {filters.q && <button type="button" className="filter-chip" onClick={() => update({q:""})}>Search: {filters.q} <span aria-hidden="true">×</span></button>}
        {filters.category && <button type="button" className="filter-chip" onClick={() => update({category:""})}>{display(filters.category)} <span aria-hidden="true">×</span></button>}
        {filters.gravity && <button type="button" className="filter-chip" onClick={() => update({gravity:""})}>{display(filters.gravity)} <span aria-hidden="true">×</span></button>}
        <button type="button" className="text-button" onClick={reset}>Reset filters</button>
      </div>}
    </section>
    <div className="discovery-results-bar"><p role="status" aria-live="polite">{result ? `${result.total} matching investigations` : "Searching the catalog…"}</p>
      <div className="view-switch" role="group" aria-label="Investigation results view"><button type="button" aria-pressed={filters.view==="cards"} onClick={() => update({view:"cards",offset:filters.offset})}>Cards</button><button type="button" aria-pressed={filters.view==="table"} onClick={() => update({view:"table",offset:filters.offset})}>Table</button></div>
    </div>
    {error && <Failure message={error} retry={() => setRevision(v => v+1)} />}
    {!result && !error && <Loading label="Searching the investigation registry…" />}
    {result && records.length===0 && <EmptyState><h2 className="section-title">A different question may open another path.</h2><p>No investigations match these filters. Try “solid”, “smoke”, or a program acronym.</p><button className="secondary-button" type="button" onClick={reset}>Reset filters</button></EmptyState>}
    {result && records.length>0 && <div data-testid="investigation-results">{filters.view==="cards" ? <div className="investigation-grid">{records.map((inv,index) => <InvestigationCard key={inv.investigation_id} inv={inv} index={filters.offset+index} selected={selected.some(i => i.investigation_id===inv.investigation_id)} disabled={selected.length>=4 && !selected.some(i => i.investigation_id===inv.investigation_id)} onSelect={checked => choose(inv,checked)} />)}</div> :
      <div className="discovery-table-scroll" role="region" aria-label="Investigation table, scroll horizontally to inspect all columns" tabIndex={0}><table className="research-table"><caption className="sr-only">NASA investigations and available evidence</caption><thead><tr><th scope="col">Compare</th><th scope="col">Investigation</th><th scope="col">Research scope</th><th scope="col">Available evidence</th></tr></thead><tbody>{records.map(inv => <tr key={inv.investigation_id} data-selected={selected.some(i => i.investigation_id===inv.investigation_id)}><td><label className="comparison-choice"><input type="checkbox" aria-label={`Compare ${inv.name}`} checked={selected.some(i => i.investigation_id===inv.investigation_id)} disabled={selected.length>=4 && !selected.some(i => i.investigation_id===inv.investigation_id)} onChange={e => choose(inv,e.target.checked)}/></label></td><th scope="row"><Link href={`/investigations/${encodeURIComponent(inv.investigation_id)}`}>{inv.name}</Link><p className="text-mist">{inv.full_name}</p></th><td>{display(inv.category)}<p className="text-mist">{display(inv.gravity_regime)}</p></td><td><span className="evidence-badge" data-tone={inv.measurement_count ? "observed" : "unavailable"}>{inv.measurement_count} validated measurements</span><p className="text-mist">{inv.datasets.length} imported datasets / {inv.source_ids.length} sources</p></td></tr>)}</tbody></table></div>}
    </div>}
    {result && result.total>0 && <nav className="discovery-pagination" aria-label="Investigation pages"><button className="secondary-button" type="button" disabled={filters.offset===0} onClick={() => update({offset:Math.max(0,filters.offset-50)})}>← Previous</button><span>{filters.offset+1}-{Math.min(filters.offset+50,result.total)} of {result.total}</span><button className="secondary-button" type="button" disabled={filters.offset+50>=result.total} onClick={() => update({offset:filters.offset+50})}>Next →</button></nav>}
    {selected.length>0 && <>
      <section className="qualitative-comparison" ref={comparison} tabIndex={-1} aria-labelledby="comparison-title"><div className="discovery-section-heading"><div><p className="eyebrow">Side by side / metadata</p><h2 className="section-title" id="comparison-title">Investigation comparison</h2></div><button type="button" className="text-button" onClick={() => setSelected([])}>Clear selection</button></div>
        {selected.length<2 ? <p className="text-mist">Select another investigation to compare objectives, conditions, and evidence availability.</p> : <><p className="comparison-boundary">Qualitative comparison. Shared topics do not establish comparable outcomes. Missing conditions prevent conclusions about atmospheric or material equivalence.</p><div className="discovery-table-scroll" role="region" aria-label="Selected investigation comparison, horizontally scrollable" tabIndex={0}><table className="research-table"><caption className="sr-only">Selected investigation attributes</caption><thead><tr><th scope="col">Attribute</th>{selected.map(i => <th scope="col" key={i.investigation_id}>{i.name}</th>)}</tr></thead><tbody>{["objective","category","gravity_regime","conditions","measurement_count"].map(key => <tr key={key}><th scope="row">{display(key)}</th>{selected.map(i => <td key={i.investigation_id}>{display(i[key])}</td>)}</tr>)}<tr><th scope="row">Applicability limitations</th>{selected.map(i => <td key={i.investigation_id}><ul>{i.limitations.map(l => <li key={l}>{l}</li>)}</ul></td>)}</tr><tr><th scope="row">Sources</th>{selected.map(i => <td key={i.investigation_id}><SourceLinks ids={i.source_ids}/></td>)}</tr></tbody></table></div><Link className="discovery-inline-link" href="/compare">Compare study measurements <span aria-hidden="true">↗</span></Link></>}
      </section>
      <div className="comparison-tray" aria-label="Selected investigations"><div><strong>{selected.length} selected</strong><span>{selected.map(i => i.name).join(" / ")}</span></div><button className="primary-button" type="button" disabled={selected.length<2} onClick={focusComparison}>Compare selected →</button><button className="text-button" type="button" onClick={() => setSelected([])}>Clear</button></div>
    </>}
  </div>;
}

function InvestigationCard({inv,index,selected,disabled,onSelect}:{inv:Investigation;index:number;selected:boolean;disabled:boolean;onSelect:(checked:boolean)=>void}) {
  return <article className="investigation-card" data-selected={selected}>
    <div className="investigation-card-top"><span className="eyebrow">{String(index+1).padStart(2,"0")} / {display(inv.category)}</span><label className="comparison-choice"><input type="checkbox" checked={selected} disabled={disabled} aria-label={`Compare ${inv.name}`} onChange={e => onSelect(e.target.checked)}/><span>{selected ? "Selected" : "Compare"}</span></label></div>
    <h2><Link href={`/investigations/${encodeURIComponent(inv.investigation_id)}`}>{inv.name}<span aria-hidden="true">↗</span></Link></h2><p className="investigation-full-name">{inv.full_name}</p>
    <div className="investigation-evidence"><span className="evidence-badge" data-tone={inv.measurement_count ? "observed" : "unavailable"}>{inv.measurement_count} validated measurements</span><span className="investigation-gravity"><span aria-hidden="true">◌</span> {display(inv.gravity_regime)}</span></div>
    <div className="investigation-card-meta"><span>{inv.datasets.length} imported datasets</span><span>{inv.source_ids.length} source references</span></div>
    <details className="investigation-expand"><summary>Research objective and sources <span aria-hidden="true">+</span></summary><div><p>{inv.objective || inv.summary || "Objective unavailable from the registered source."}</p><SourceLinks ids={inv.source_ids}/></div></details>
  </article>;
}
