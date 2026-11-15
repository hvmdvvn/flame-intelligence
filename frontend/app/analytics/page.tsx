"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Failure, Loading } from "@/components/Chrome";
import { PageIntro, SourceLinks, display, downloadJSON } from "@/components/ResearchUI";
import { api } from "@/lib/api";
import type { Analytics, AnalyticsGroup, ModelStatus, PublishedValue } from "@/lib/research-types";
import "@/app/workbench.css";

type NumericalValue=PublishedValue & {measurement_family?:string};

export default function AnalyticsPage(){
  const [data,setData]=useState<Analytics | null>(null);const [model,setModel]=useState<ModelStatus | null>(null);
  const [error,setError]=useState("");const [modelError,setModelError]=useState("");const [revision,setRevision]=useState(0);
  const [kind,setKind]=useState("");const [quantity,setQuantity]=useState("");const [dataset,setDataset]=useState("");
  useEffect(() => {let active=true;setError("");setModelError("");api<Analytics>("/api/analytics").then(v => {if(active) setData(v);}).catch((e:Error) => {if(active) setError(e.message);});api<ModelStatus>("/api/models").then(v => {if(active) setModel(v);}).catch((e:Error) => {if(active) setModelError(e.message);});return () => {active=false;};},[revision]);
  const published=(data?.published_values ?? []) as NumericalValue[];
  const quantities=useMemo(() => [...new Set([...(data?.groups.map(g => g.measurement_family) ?? []),...published.map(v => v.measurement_family).filter((v):v is string => Boolean(v))])].sort(),[data]);
  const datasets=useMemo(() => [...new Set(data?.groups.flatMap(g => g.values.map(v => v.dataset_id).filter((v):v is string => Boolean(v))) ?? [])].sort(),[data]);
  const groups=(data?.groups ?? []).filter(g => (!quantity || g.measurement_family===quantity) && (!kind || (g.evidence_class ?? g.evidence_classification)===kind) && (!dataset || g.values.some(v => v.dataset_id===dataset)));
  const values=published.filter(v => (!kind || v.evidence_class===kind) && (!quantity || v.measurement_family===quantity));
  return <div>
    <PageIntro eyebrow="Measurements and models" title="Research data">Review published values and imported measurements, with units and source references. Filter observations and reported model results separately.</PageIntro>
    {error && <Failure message={error} retry={() => setRevision(v => v+1)}/>}
    {!data && !error && <Loading label="Loading available measurements and their provenance"/>}
    {data && <>
      <dl className="wb-facts"><div><dt>Page-checked publication values</dt><dd>{published.length}</dd></div><div><dt>Imported measurement groups</dt><dd>{data.groups.length}</dd></div><div><dt>Published observations / models</dt><dd>{published.filter(v => v.evidence_class==="directly_observed_result").length}<span className="text-mist"> / </span>{published.filter(v => v.evidence_class==="model_prediction").length}</dd></div></dl>
      <div className="wb-filter-row"><label className="field-label">Evidence class<select className="field-input" value={kind} onChange={e => setKind(e.target.value)}><option value="">All evidence classes</option><option value="directly_observed_result">Observed / page-checked</option><option value="model_prediction">Reported computational model</option></select></label>
        {!!quantities.length && <label className="field-label">Measurement definition<select className="field-input" value={quantity} onChange={e => setQuantity(e.target.value)}><option value="">All definitions</option>{quantities.map(q => <option key={q} value={q}>{display(q)}</option>)}</select></label>}
        {!!datasets.length && <label className="field-label">Imported dataset<select className="field-input" value={dataset} onChange={e => setDataset(e.target.value)}><option value="">All imported datasets</option>{datasets.map(id => <option key={id} value={id}>{id}</option>)}</select></label>}
        <button type="button" className="secondary-button" onClick={() => {setKind("");setQuantity("");setDataset("");}} disabled={!kind && !quantity && !dataset}>Reset view</button><button type="button" className="secondary-button" onClick={() => downloadJSON(data,"flame-analytics.json")}>Export analysis JSON ↗</button>
      </div>
      <section className="wb-section" aria-labelledby="imported-title"><p className="wb-kicker">Experimental data</p><h2 id="imported-title" className="wb-title mt-4">Imported measurements</h2>
        {data.groups.length===0 ? <div className="wb-empty"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 36V12M8 36H40M15 28l7-8 7 4 11-14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/><circle cx="22" cy="20" r="3" stroke="currentColor"/></svg><h3 className="text-xl font-semibold">No validated imported measurements yet.</h3><p className="wb-copy mt-4">Import authorized experimental files to view run-level measurements and summaries.</p><Link href="/sources" className="wb-text-link mt-4">Inspect data availability and source status ↗</Link></div>
          : groups.length===0 ? <div className="wb-empty"><p className="wb-copy">No imported groups match these filters. Reset the view to inspect other definitions, datasets, or evidence classes.</p></div>
          : <div className="mt-7 space-y-6">{groups.map((group,index) => <MeasurementGroup group={group} key={`${group.measurement_family}-${group.unit}-${index}`}/>)}</div>}
      </section>
      <section className="wb-section" aria-labelledby="published-title"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="wb-kicker">From the publications</p><h2 id="published-title" className="wb-title mt-4">Published numerical evidence</h2></div><button type="button" className="secondary-button" disabled={!values.length} onClick={() => exportCSV(values)}>Export these values CSV ↗</button></div>
        <p className="wb-copy mt-5">Values transcribed from the cited publication pages. Each record identifies whether the result was observed or modeled.</p>
        <p className="mt-5 text-sm text-mist" role="status">{values.length} of {published.length} publication values in this view.</p>
        {values.length ? <div className="wb-table-scroll mt-5" role="region" aria-label="Published numerical evidence, scroll horizontally on small screens" tabIndex={0}><table className="research-table"><caption className="sr-only">Published numerical values and scientific provenance</caption><thead><tr><th scope="col">Study / quantity</th><th scope="col">Value</th><th scope="col">Evidence class</th><th scope="col">Source</th></tr></thead><tbody>{values.map(v => <tr key={v.measurement_id}><th scope="row"><p className="font-semibold">{v.label ?? v.measurement_id}</p><p className="mt-2 text-sm font-normal text-mist">{v.method}</p><p className="mt-3 text-xs font-normal text-mist">{v.limitation ?? "Review the original publication and run conditions."}</p></th><td className="font-mono whitespace-nowrap">{v.value} {v.unit}</td><td><span className="wb-badge" data-kind={v.evidence_class==="model_prediction" ? "model" : "observed"}>{display(v.evidence_class)}</span><p className="mt-3 text-xs text-mist">Training eligible: {v.training_eligible ? "yes" : "no"}</p></td><td><Link href={`/research/${encodeURIComponent(v.paper_id)}`} className="wb-text-link">{v.paper_id} ↗</Link><p className="text-sm text-mist">PDF page {v.provenance?.page_number ?? "unavailable"} · {v.provenance?.location}</p></td></tr>)}</tbody></table></div>
          : <div className="wb-empty"><p className="wb-copy">No page-checked publication value matches the selected evidence class or definition. Reset the view to see the available records.</p></div>}
      </section>
      <details className="wb-metadata"><summary className="cursor-pointer font-semibold">Method, exclusions, and scientific limitations</summary><ul className="mt-5 space-y-3 text-mist">{data.limitations.map(l => <li key={l}>{l}</li>)}</ul>{!!data.exclusions.length && <><h3 className="mt-6 font-semibold">Excluded records ({data.exclusions.length})</h3><pre className="mt-4">{JSON.stringify(data.exclusions,null,2)}</pre></>}</details>
    </>}
    <section className="wb-section" aria-labelledby="model-title"><p className="wb-kicker">Model status</p><h2 id="model-title" className="wb-title mt-4">Predictive models</h2>
      {modelError && <div className="mt-5"><Failure message={modelError} retry={() => setRevision(v => v+1)}/></div>}{!model && !modelError && <Loading label="Checking whether an evaluated model is available"/>}
      {model && <div className="wb-grid mt-7"><div className="wb-panel"><span className="wb-badge" data-kind="blocked">{display(model.status)}</span><h3 className="text-2xl font-semibold mt-5">No predictive model available</h3><p className="wb-copy mt-4">{model.reason ?? "No evaluated predictive model has been registered."}</p><p className="wb-copy mt-4">Prediction remains unavailable until training data and independent evaluation are available.</p><Link className="wb-text-link mt-4" href="/sources">Inspect the underlying evidence ↗</Link></div><div><h3 className="text-lg font-semibold">What a model would require</h3><ol className="wb-checklist">{(model.requirements ?? model.required ?? []).map((line,index) => <li key={line}><span className="wb-check-icon">{index+1}</span><span>{line}</span></li>)}</ol><details className="wb-metadata mt-6"><summary className="cursor-pointer">Inspect feasibility metadata</summary><pre className="mt-4">{JSON.stringify(model,null,2)}</pre></details></div></div>}
    </section>
  </div>;
}

function MeasurementGroup({group}:{group:AnalyticsGroup}){
  const max=Math.max(1,...group.values.map(v => Math.abs(v.value)));const evidence=group.evidence_class ?? group.evidence_classification;
  return <article className="wb-panel"><div className="flex flex-wrap gap-3 items-start justify-between"><h3 className="wb-title">{display(group.measurement_family)} <span className="text-mist">({group.unit})</span></h3><span className="wb-badge" data-kind={evidence==="model_prediction" ? "model" : "observed"}>{display(evidence)}</span></div><p className="wb-copy mt-4">{group.count} records. This descriptive summary preserves dataset and run boundaries and makes no causal inference.</p>
    <dl className="wb-facts">{[["Minimum",group.min],["Maximum",group.max],["Mean",group.mean]].map(([label,value]) => <div key={String(label)}><dt>{label}</dt><dd className="!text-2xl">{typeof value==="number" ? Number(value.toPrecision(6)) : value}<span className="ml-2 text-sm font-normal">{group.unit}</span></dd></div>)}</dl>
    <figure><figcaption className="text-sm text-mist mb-5">Individual recorded values ({group.unit}); zero-based bars. Only the first 50 values are shown visually; the table contains all values.</figcaption><div aria-hidden="true">{group.values.slice(0,50).map((v,index) => <div key={index} className="wb-data-row"><span>{v.run_id ?? v.study_id ?? `Record ${index+1}`}</span><span className="wb-bar"><span style={{width:`${Math.abs(v.value)/max*100}%`}}/></span><span className="font-mono">{v.value} {group.unit}</span></div>)}</div></figure>
    <details className="mt-6"><summary className="cursor-pointer font-semibold">Inspect all values and provenance</summary><div className="wb-table-scroll mt-5" role="region" aria-label={`Source records for ${group.measurement_family}`} tabIndex={0}><table className="research-table"><caption className="sr-only">Source records for {group.measurement_family}</caption><thead><tr><th scope="col">Run / study</th><th scope="col">Value</th><th scope="col">Dataset</th><th scope="col">Source</th><th scope="col">Evidence</th></tr></thead><tbody>{group.values.map((v,index) => <tr key={index}><th scope="row">{v.run_id ?? v.study_id ?? "Not available"}</th><td>{v.value} {group.unit}</td><td>{display(v.dataset_id)}</td><td>{v.source_id ? <SourceLinks ids={[v.source_id]}/> : "Not available"}</td><td>{display(v.evidence_class ?? v.evidence_classification ?? evidence)}</td></tr>)}</tbody></table></div></details>
  </article>;
}

function exportCSV(values:NumericalValue[]){
  const cell=(value:unknown) => {let text=value==null ? "" : String(value);if(typeof value!=="number" && /^[=+@-]/.test(text)) text="'"+text;return `"${text.replace(/"/g,'""')}"`;};
  const rows=[["measurement_id","study","value","unit","evidence_class","paper_id","pdf_page","source_location","limitation"],...values.map(v => [v.measurement_id,v.label,v.value,v.unit,v.evidence_class,v.paper_id,v.provenance?.page_number,v.provenance?.location,v.limitation])];
  const href=URL.createObjectURL(new Blob([rows.map(row => row.map(cell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=href;a.download="flame-published-values-with-provenance.csv";a.click();window.setTimeout(() => URL.revokeObjectURL(href),1000);
}
