"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Failure, Loading } from "@/components/Chrome";
import { PageIntro } from "@/components/ResearchUI";
import { api } from "@/lib/api";
import type { CompareResponse, Study } from "@/lib/types";
import "@/app/workbench.css";

const ROWS:{key:keyof Study;label:string}[]=[{key:"fuel_family",label:"Fuel family"},{key:"gravity_regime",label:"Gravity"},{key:"platform",label:"Platform"},{key:"oxygen_as_reported",label:"Oxygen as reported"},{key:"pressure_as_reported",label:"Pressure as reported"},{key:"method",label:"Method"}];
const CHECKS=[{label:"Same verified measurement definition",codes:["measurement_mismatch","definition_unclassified","ambiguous_values","missing_value","unverified_value"]},{label:"Compatible documented units",codes:["unit_mismatch","missing_value"]},{label:"Same fuel family",codes:["fuel_mismatch"]},{label:"Same gravity regime",codes:["gravity_mismatch"]},{label:"Source-backed values and matching evidence classes",codes:["evidence_class_mismatch","unverified_value","missing_value"]}];

export default function ComparePage() {
  const [studies,setStudies]=useState<Study[] | null>(null);
  const [left,setLeft]=useState("");const [right,setRight]=useState("");
  const [result,setResult]=useState<CompareResponse | null>(null);
  const [error,setError]=useState<string | null>(null);const [pending,setPending]=useState(false);const [revision,setRevision]=useState(0);
  useEffect(() => {let active=true;setError(null);api<{studies:Study[]}>("/api/studies").then(payload => {if(!active) return;setStudies(payload.studies);setLeft(v => v || payload.studies[0]?.study_id || "");setRight(v => v || payload.studies[1]?.study_id || "");}).catch((reason:Error) => {if(active) setError(reason.message);});return () => {active=false;};},[revision]);
  async function run(){if(pending) return;setPending(true);setError(null);setResult(null);try{setResult(await api<CompareResponse>("/api/compare",{method:"POST",body:JSON.stringify({left_study_id:left,right_study_id:right,measurement_family:null})}));}catch(reason){setError(reason instanceof Error ? reason.message : "Comparison failed.");}finally{setPending(false);}}
  function choose(side:"left"|"right",value:string){if(side==="left") setLeft(value);else setRight(value);setResult(null);setError(null);}
  return <div>
    <PageIntro eyebrow="Study comparison" title="Compare study conditions">Choose two studies to check their measurements, units, fuel, and gravity conditions before plotting the results.</PageIntro>
    <div className="wb-grid wb-section">
      <section className="min-w-0" aria-labelledby="choose-title"><p className="wb-kicker">Select studies</p><h2 id="choose-title" className="wb-title mt-4">Which studies are you comparing?</h2><p className="wb-copy mt-4">The available values have been checked against the publication pages. Observations and model results are compared separately.</p>
        {error && <div className="mt-6"><Failure message={error} retry={() => studies ? void run() : setRevision(v => v+1)} /></div>}
        {!studies && !error && <div className="mt-6"><Loading label="Loading page-checked study records" /></div>}
        {studies && studies.length<2 && <div className="wb-empty"><h3 className="text-xl font-semibold">Two studies are needed to compare measurements.</h3><p className="wb-copy mt-4">There are fewer than two verified study records available. Browse the publications for more context.</p><Link className="wb-text-link mt-4" href="/research">Explore the publication archive ↗</Link></div>}
        {studies && studies.length>=2 && <form className="mt-7" onSubmit={event => {event.preventDefault();void run();}}>
          <div className="wb-study-grid"><StudySelect label="Left study" side="A" value={left} studies={studies} onChange={value => choose("left",value)} disabled={pending}/><StudySelect label="Right study" side="B" value={right} studies={studies} onChange={value => choose("right",value)} disabled={pending}/></div>
          <div className="wb-actions"><button className="primary-button" type="submit" disabled={pending || !left || !right || left===right}>{pending ? "Checking..." : "Check comparison"} <span aria-hidden="true">↗</span></button><span className="text-sm text-mist">{left===right ? "Choose two different study records." : "Checks the reported study conditions."}</span></div>
        </form>}
      </section>
      <aside className="wb-gate" aria-labelledby="gate-title"><p className="wb-kicker">Comparison criteria</p><h2 id="gate-title" className="wb-title mt-4">Required matches</h2>
        <svg className="wb-gate-symbol" viewBox="0 0 300 75" fill="none" aria-hidden="true"><path d="M0 18H70C100 18 100 37 130 37M0 57H70C100 57 100 37 130 37M170 37H300" stroke="currentColor" strokeWidth="1.5"/><rect x="131" y="8" width="38" height="58" rx="19" stroke="currentColor" strokeWidth="1.5"/><path d="m146 28 9 9-9 9" stroke="currentColor" strokeWidth="1.5"/></svg>
        <span className="wb-badge" data-kind={result?.chart_allowed ? "observed" : "blocked"}>{pending ? "Checking evidence" : result ? result.chart_allowed ? "Chart allowed" : "Chart blocked" : "Not checked"}</span>
        <ul className="wb-checklist">{CHECKS.map((check,index) => {const failed=result?.reasons.some(r => check.codes.includes(r.code));const state=!result ? "pending" : failed ? "blocked" : "checked";return <li key={check.label} data-status={state}><span className="wb-check-icon" aria-hidden="true">{!result ? String(index+1) : failed ? "!" : "✓"}</span><span>{check.label}<span className="block text-xs text-mist">{!result ? "Not checked yet" : failed ? "Mismatch found" : "No mismatch reported"}</span></span></li>;})}</ul>
        <p className="mt-5 text-sm leading-relaxed text-mist">Study measurements must match these criteria to share a chart.</p>
      </aside>
    </div>
    {result && <Verdict result={result} />}
  </div>;
}

function StudySelect({label,side,value,studies,onChange,disabled}:{label:string;side:string;value:string;studies:Study[];onChange:(value:string)=>void;disabled:boolean}){
  const study=studies.find(s => s.study_id===value);
  return <div className="wb-study"><span className="wb-kicker">Study {side}</span><label className="mt-3">{label}<select className="field-input" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{studies.map(s => <option key={s.study_id} value={s.study_id}>{s.label}</option>)}</select></label>
    {study && <><dl><div><dt>Fuel family</dt><dd>{show(study.fuel_family)}</dd></div><div><dt>Gravity regime</dt><dd>{show(study.gravity_regime)}</dd></div><div><dt>Oxygen as reported</dt><dd>{show(study.oxygen_as_reported)}</dd></div><div><dt>Page-checked values</dt><dd>{study.measurements.filter(m => m.verification_status==="verified" && m.value!==null).length}</dd></div></dl><Link className="wb-text-link mt-4" href={`/research/${encodeURIComponent(study.paper_id)}`}>Inspect source publication ↗</Link></>}
  </div>;
}

function Verdict({result}:{result:CompareResponse}){
  const insufficient=result.reasons.some(r => ["missing_value","unverified_value","ambiguous_values","definition_unclassified"].includes(r.code));
  return <section className="wb-section" aria-labelledby="verdict-title">
    <div className="wb-verdict" data-allowed={result.chart_allowed}><p className="wb-kicker">Result</p><h2 id="verdict-title" className="wb-title mt-4">{result.chart_allowed ? "Comparison available" : "Comparison unavailable"}</h2><p className="wb-copy mt-4">{result.chart_allowed ? "The reported values meet the comparison criteria. Review the conditions below when interpreting differences." : insufficient ? "There are not enough verified values to compare these studies." : "These records have different study conditions or measurement definitions. See the mismatches below."}</p>
      {!!result.reasons.length && <ul className="mt-5 space-y-3">{result.reasons.map(r => <li key={r.code} className="text-sm leading-relaxed text-mist">• {r.message}</li>)}</ul>}
    </div>
    <div className="wb-table-scroll" role="region" aria-label="Study condition comparison, scroll horizontally on small screens" tabIndex={0}><table className="research-table"><caption>Reported study conditions and measurement definitions</caption><thead><tr><th scope="col">Condition</th><th scope="col">Left study</th><th scope="col">Right study</th></tr></thead><tbody>{ROWS.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{show(result.left[row.key])}</td><td>{show(result.right[row.key])}</td></tr>)}<tr><th scope="row">Measurements</th><td>{measurementList(result.left)}</td><td>{measurementList(result.right)}</td></tr></tbody></table></div>
    {!!result.caveats.length && <div className="wb-notice mt-6"><h3 className="font-semibold">Comparison notes</h3><ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist">{result.caveats.map(r => <li key={r.code}>{r.message}</li>)}</ul></div>}
    {!!result.missing_fields.length && <p className="wb-copy mt-5">Not reported on at least one study: {result.missing_fields.map(f => f.replace(/_/g," ")).join(", ")}. </p>}
    {result.chart_allowed && result.points.length>0 && <MeasuredChart result={result} />}
  </section>;
}

function MeasuredChart({result}:{result:CompareResponse}){
  const max=Math.max(...result.points.map(p => p.value),1);const limit=Math.ceil(max*1.1*10)/10;const unit=result.points[0].unit;
  return <figure className="wb-panel mt-8"><figcaption><h3 className="wb-title">{result.matched_measurement_family?.replace(/_/g," ")}</h3><p className="wb-copy mt-3">Source-reported values in {unit}. Bars share a zero baseline. Conditions and caveats above remain part of the comparison.</p></figcaption>
    <div className="mt-7" aria-hidden="true">{result.points.map(p => <div className="wb-data-row" key={p.study_id}><span>{p.label}</span><span className="wb-bar"><span style={{width:`${p.value/limit*100}%`}} /></span><span className="font-mono">{p.value} {unit}</span></div>)}<div className="wb-data-row text-mist"><span>Value ({unit})</span><span className="flex justify-between"><span>0</span><span>{limit/2}</span><span>{limit}</span></span><span /></div></div>
    <div className="wb-table-scroll mt-6" role="region" aria-label="Chart data and page-level provenance" tabIndex={0}><table className="research-table"><caption className="sr-only">Underlying comparison chart values</caption><thead><tr><th scope="col">Study</th><th scope="col">Value</th><th scope="col">Uncertainty</th><th scope="col">Source</th></tr></thead><tbody>{result.points.map(p => {const study=p.study_id===result.left.study_id ? result.left : result.right;return <tr key={p.study_id}><th scope="row">{p.label}</th><td>{p.value} {p.unit}</td><td>{p.uncertainty ?? "Not reported"}</td><td><Link href={`/research/${encodeURIComponent(study.paper_id)}`} className="wb-text-link">PDF page {p.page_number ?? "unavailable"} ↗</Link><p className="text-sm text-mist">{p.provenance}</p></td></tr>;})}</tbody></table></div>
  </figure>;
}

function show(value:unknown){if(value===null || value===undefined || value==="" || value==="not_reported") return "Not reported";return String(value);}
function measurementList(study:Study){if(!study.measurements?.length) return "Not reported";return study.measurements.map(m => `${m.measurement_as_reported}: ${m.value===null || m.value===undefined ? "not reported" : `${m.value} ${m.unit ?? ""}`.trim()} (${m.verification_status})`).join("; ");}
