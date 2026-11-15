"use client";

import { useEffect, useState } from "react";
import { Failure, Loading } from "@/components/Chrome";
import { EmptyState, PageIntro, SourceCard, SourceLinks, display } from "@/components/ResearchUI";
import { api } from "@/lib/api";
import type { ContextEntry, ResearchContext, Source } from "@/lib/research-types";

export default function SourcesPage() {
  const [sources,setSources] = useState<Source[] | null>(null); const [context,setContext] = useState<ResearchContext | null>(null);
  const [error,setError] = useState(""); const [contextError,setContextError] = useState(""); const [revision,setRevision] = useState(0);
  const [filter,setFilter] = useState(""); const [tab,setTab] = useState("registry");
  const [sourceTarget,setSourceTarget] = useState("");
  useEffect(() => { let active=true; setError(""); setContextError("");
    api<{sources:Source[]}>("/api/sources").then(v => { if(active) setSources(v.sources); }).catch((e: Error) => { if(active) setError(e.message); });
    api<ResearchContext>("/api/context").then(v => { if(active) setContext(v); }).catch((e: Error) => { if(active) setContextError(e.message); });
    return () => { active=false; };
  }, [revision]);
  useEffect(() => {
    const followHash=() => {
      let id=""; try { id=decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if(id) { setTab("registry"); setFilter(""); setSourceTarget(id); }
    };
    followHash(); window.addEventListener("hashchange",followHash);
    return () => window.removeEventListener("hashchange",followHash);
  }, []);
  useEffect(() => { if(!sources || tab!=="registry" || filter || !sourceTarget) return;
    const frame=requestAnimationFrame(() => document.getElementById(sourceTarget)?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [sources,tab,filter,sourceTarget]);
  const filtered=(sources ?? []).filter(s => `${s.name} ${s.source_id} ${s.organization} ${s.retrieval_status}`.toLowerCase().includes(filter.toLowerCase()));
  return <div onClickCapture={e => {
    const anchor=(e.target as Element).closest("a");
    if(!anchor || anchor.pathname!=="/sources" || !anchor.hash) return;
    try { setTab("registry"); setFilter(""); setSourceTarget(decodeURIComponent(anchor.hash.slice(1))); } catch { /* Invalid fragment cannot target a registry entry. */ }
  }}>
    <PageIntro eyebrow="Reference library" title="Sources and context">
      Find original records, access details, and usage rights, plus historical accounts and educational resources.
    </PageIntro>
    <div className="mb-6 flex flex-wrap gap-2" aria-label="Source sections">{[
      ["registry","Source registry"],["incidents","Historical incidents"],["earth","Earth applications"],["education","Education"],
    ].map(([id,label]) => <button type="button" key={id} aria-pressed={tab===id} className={tab===id ? "primary-button" : "secondary-button"} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === "registry" && <>
      <label className="field-label mb-5 max-w-lg">Filter sources<input className="field-input" value={filter} placeholder="Name, source identifier, retrieval status…" onChange={e => setFilter(e.target.value)} /></label>
      {error && <Failure message={error} retry={() => setRevision(v => v+1)} />}
      {!sources && !error && <Loading label="Loading the provenance registry…" />}
      {sources && <><p className="mb-4 text-xs text-mist" role="status">{filtered.length} of {sources.length} registered sources</p><div className="space-y-4">{filtered.map(s => <SourceCard source={s} key={s.source_id} />)}</div>
        {filtered.length===0 && <EmptyState>No sources match this filter.</EmptyState>}</>}
    </>}
    {tab !== "registry" && <>
      {contextError && <Failure message={contextError} retry={() => setRevision(v => v+1)} />}
      {!context && !contextError && <Loading label="Loading NASA historical and educational context…" />}
      {context && <>
        {tab === "incidents" && <><h2 className="mb-3 section-title">Historical incidents</h2><p className="mb-5 text-sm text-mist">Apollo 1 was a cabin fire during a ground test. Apollo 13 involved an oxygen-tank failure and explosion. The Mir account concerns an onboard fire. </p><ContextCards entries={context.incidents} /></>}
        {tab === "earth" && <><h2 className="mb-3 section-title">Documented technology transfer</h2><p className="mb-5 text-sm text-mist">Historical technology adaptations documented by NASA Spinoff. Current product availability is not verified.</p><ContextCards entries={context.earth_applications} /></>}
        {tab === "education" && <><h2 className="mb-3 section-title">Educational resources</h2><p className="mb-5 text-sm text-mist">Introductions to combustion and microgravity research.</p><ContextCards entries={context.education} /></>}
      </>}
    </>}
  </div>;
}

function ContextCards({ entries }: { entries: ContextEntry[] }) {
  if(!entries.length) return <EmptyState>No verified resources have been registered for this section.</EmptyState>;
  return <div className="space-y-4">{entries.map((entry,index) => <article key={entry.id ?? entry.name ?? index} className="border border-line bg-raise p-5">
    <p className="text-xs text-mist">{display(entry.event_date ?? entry.date ?? entry.publication_date)}{entry.type || entry.classification ? ` · ${display(entry.type ?? entry.classification)}` : ""}</p>
    <h3 className="mt-2 text-lg font-semibold">{entry.name ?? entry.title ?? "Context resource"}</h3>
    {(entry.description || entry.summary) && <p className="mt-3 max-w-4xl text-sm leading-relaxed text-mist">{entry.description ?? entry.summary}</p>}
    {entry.lessons?.length ? <ul className="mt-3 space-y-2 text-sm">{entry.lessons.map(l => <li key={l}>{l}</li>)}</ul> : null}
    {entry.limitations?.length ? <ul className="mt-3 space-y-2 text-xs text-warn">{entry.limitations.map(l => <li key={l}>{l}</li>)}</ul> : null}
    <div className="mt-4"><SourceLinks ids={entry.source_ids ?? (entry.source_id ? [entry.source_id] : [])} /></div>
    {entry.url && /^https?:\/\//i.test(entry.url) && <a href={entry.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-ember underline">Read original resource ↗</a>}
    <details className="mt-4 text-xs"><summary className="cursor-pointer text-mist">Inspect recorded metadata</summary><dl className="mt-3 space-y-3">{Object.entries(entry).filter(([k]) => !["lessons","limitations","source_ids","url"].includes(k)).map(([key,value]) => <div key={key}><dt className="text-mist">{display(key)}</dt><dd className="mt-1">{display(value)}</dd></div>)}</dl></details>
  </article>)}</div>;
}
