"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Failure, Loading } from "@/components/Chrome";
import { PageIntro } from "@/components/ResearchUI";
import { api } from "@/lib/api";
import type { AskResponse } from "@/lib/types";
import "@/app/workbench.css";

const SUGGESTIONS = [
  "How does confinement affect flame spread in microgravity?",
  "What materials or fuels were burned in these experiments?",
  "What role does oxygen concentration play in microgravity flame spread?",
  "What did Saffire observe about spacecraft fire?",
];

export function Docket({ initialPaper, initialQuestion }: { initialPaper: string; initialQuestion: string }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [paperId, setPaperId] = useState(initialPaper);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [openPassage, setOpenPassage] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (request.current) return;
    if (trimmed.length < 3) { setError("Enter a scientific question of at least three characters."); return; }
    const controller = new AbortController(); request.current = controller;
    setQuestion(trimmed); setPending(true); setError(null); setResult(null); setNotice(""); setOpenPassage("");
    try {
      const payload = await api<AskResponse>("/api/ask", { method:"POST", signal:controller.signal,
        body:JSON.stringify({question:trimmed,paper_id:paperId || null,max_passages:4}) });
      if (!controller.signal.aborted) setResult(payload);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Evidence retrieval failed.");
    } finally {
      if (request.current === controller) { request.current = null; setPending(false); }
    }
  }
  function cancel() { request.current?.abort(); request.current=null; setPending(false); setNotice("Retrieval cancelled. Your question has been kept."); }
  async function copy() {
    if(!result) return;
    try { await navigator.clipboard.writeText(result.reported.map(c => `${c.text}\n${c.title}, PDF page ${c.page_number}\n${c.official_url}`).join("\n\n")); setNotice("Quoted findings and source references copied."); }
    catch { setNotice("Clipboard access is unavailable. You can select and copy the quoted text."); }
  }

  return <div>
    <PageIntro eyebrow="Research assistant" title="Search the publications">
      Ask about fuels, flame spread, or experimental conditions. Results link to the original publication passages.
    </PageIntro>
    <div className="wb-grid wb-section">
      <div className="min-w-0">
        <section className="wb-panel" aria-labelledby="compose-title">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="compose-title" className="wb-kicker">Your research question</h2><span className="wb-badge">Publication evidence</span></div>
          {paperId && <p className="mt-4 text-sm text-mist">Scoped to <span className="font-mono break-all">{paperId}</span> <button className="wb-text-link ml-2" type="button" disabled={pending} onClick={() => setPaperId("")}>Clear scope</button></p>}
          <form onSubmit={event => {event.preventDefault();void submit();}}>
            <label className="sr-only" htmlFor="question">Scientific question</label>
            <textarea id="question" value={question} onChange={event => setQuestion(event.target.value)} rows={4} minLength={3} maxLength={2000} required className="wb-composer"
              aria-describedby="question-help" placeholder="What does the evidence say about oxygen, fuel, or flame spread?"
              onKeyDown={event => {if(event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault();if(!pending) void submit();}}} />
            <div className="wb-compose-actions"><small id="question-help">Enter to retrieve · Shift + Enter for a new line<br />{question.length.toLocaleString()} / 2,000 characters</small>
              <div className="flex flex-wrap gap-2"><button className="primary-button" type="submit" disabled={pending || question.trim().length < 3}>{pending ? "Searching..." : "Retrieve evidence"}<span aria-hidden="true"> ↗</span></button>
                {pending && <button type="button" className="secondary-button" onClick={cancel}>Cancel retrieval</button>}</div>
            </div>
          </form>
          {notice && <p className="mt-4 text-sm text-mist" role="status">{notice}</p>}
        </section>
        {!result && <section className="mt-8" aria-labelledby="suggested-title"><h2 id="suggested-title" className="text-sm font-semibold">Example questions</h2>
          <ul className="wb-prompts">{SUGGESTIONS.map(item => <li key={item}><button type="button" disabled={pending} onClick={() => void submit(item)}><span>{item}</span><span aria-hidden="true">↗</span></button></li>)}</ul>
        </section>}
        <div className="mt-8" aria-busy={pending}>
          {pending && <Loading label="Searching publication passages" />}
          {error && <Failure message={error} retry={() => void submit()} />}
          {result?.answer_mode === "insufficient" && <section className="wb-empty"><span className="wb-badge" data-kind="blocked">Insufficient evidence</span><h2 className="wb-title mt-5">No matching evidence found</h2><p className="wb-copy mt-4">{result.insufficient_reason}</p><p className="wb-copy mt-3">Try a specific material, investigation name, or experimental condition.</p><Link className="wb-text-link mt-4" href="/missions">Explore evidence gaps ↗</Link></section>}
          {result && result.answer_mode !== "insufficient" && <section aria-labelledby="findings-title">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="findings-title" className="wb-title">Source-reported findings</h2><button type="button" className="secondary-button" onClick={() => void copy()}>Copy with citations</button></div>
            <p className="wb-copy mt-4">{result.notice ?? "The statements below are attached to their supporting publication passages."}</p>
            {result.interpretation.map(item => <article key={item.claim_id} className="wb-claim"><span className="wb-badge" data-kind="interpretation">Hypothesis or interpretation</span><p className="mt-4 leading-relaxed">{item.text}</p><p className="mt-4 text-sm text-mist">Requires validation. Based on claims: <span className="break-all">{item.based_on_claim_ids.join(", ")}</span></p></article>)}
            {result.reported.map((claim,index) => <article key={claim.claim_id} className="wb-claim">
              <div className="flex flex-wrap items-center justify-between gap-3"><span className="wb-badge">Documented publication statement</span><span className="wb-kicker">{String(index+1).padStart(2,"0")} / PDF page {claim.page_number}</span></div>
              <blockquote className="mt-5">{claim.text}</blockquote><p className="mt-5 text-sm text-mist">{claim.title}</p>
              <div className="wb-actions"><Link className="secondary-button" href={`/evidence/${encodeURIComponent(claim.chunk_id)}?quote=${encodeURIComponent(claim.quote)}`}>Open passage <span aria-hidden="true">↗</span></Link><a className="wb-text-link" href={claim.official_url} target="_blank" rel="noreferrer">NTRS record ↗</a></div>
            </article>)}
          </section>}
        </div>
      </div>
      <aside className="wb-panel wb-citation-panel" aria-labelledby="citation-title">
        <p className="wb-kicker">Citations</p><h2 id="citation-title" className="wb-title mt-4">Source passages</h2>
        {!result?.passages.length ? <><p className="wb-copy mt-5">Search results will appear here with publication titles and page references.</p></> : <>
          <p className="wb-copy mt-4">{result.passages.length} retrieved passages. Quotes are traceable to these stored pages.</p>
          {result.passages.map(passage => <article className="wb-citation" key={passage.chunk_id}><p className="wb-kicker mb-3">Source {passage.rank} / PDF page {passage.page_number}</p><h3>{passage.title}</h3><p className="mt-2 font-mono">{passage.paper_id}</p>
            <button type="button" className="wb-text-link" aria-expanded={openPassage===passage.chunk_id} onClick={() => setOpenPassage(openPassage===passage.chunk_id ? "" : passage.chunk_id)}> {openPassage===passage.chunk_id ? "Close source context −" : "Read source context +"}</button>
            {openPassage===passage.chunk_id && <blockquote>{passage.text}</blockquote>}
            <div className="flex flex-wrap gap-4"><Link className="wb-text-link" href={`/evidence/${encodeURIComponent(passage.chunk_id)}`}>Inspect passage ↗</Link><a href={passage.official_url} target="_blank" rel="noreferrer" className="wb-text-link">Original record ↗</a></div>
          </article>)}
        </>}
        {result && <details className="wb-metadata mt-6"><summary className="cursor-pointer font-semibold">Retrieval method and limitations</summary><p className="mt-4 text-mist">{result.retrieval} · {result.method_version ?? "Version not provided"} · {result.model ?? "No generative model used"}</p><ul className="mt-4 space-y-3 text-mist">{(result.limitations ?? []).map(line => <li key={line}>{line}</li>)}</ul></details>}
        <p className="mt-6 text-sm leading-relaxed text-mist">Results reflect the indexed publications. Any generated interpretations are labeled separately.</p>
      </aside>
    </div>
  </div>;
}
