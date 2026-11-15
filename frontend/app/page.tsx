"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Failure } from "@/components/Chrome";
import { Reveal } from "@/components/Reveal";
import { ResearchStatistics, ResearchTopics } from "@/components/ResearchOverview";
import { api } from "@/lib/api";
import type { Paper, Stats } from "@/lib/types";
import type { InvestigationList } from "@/lib/research-types";

const PATHS = [
  { href: "/investigations", title: "Find an investigation", text: "Browse experiments by fuel, research topic, and gravity conditions.", cta: "Explore investigations", number: "01" },
  { href: "/compare", title: "Compare studies", text: "Check whether two studies report measurements under comparable conditions.", cta: "Open comparison", number: "02" },
  { href: "/ask", title: "Search the evidence", text: "Ask a research question and read relevant passages from the original papers.", cta: "Ask the research assistant", number: "03" },
];

function FlameComparison() {
  return <figure className="flame-comparison">
    <div className="flame-comparison-heading"><span className="figure-label">A change in gravity</span><span aria-hidden="true">01 / 02</span></div>
    <div className="flame-specimens">
      <div className="flame-specimen">
        <svg viewBox="0 0 180 230" fill="none" aria-hidden="true"><path d="M91 19C97 77 145 104 141 151C138 190 116 208 88 208C54 208 35 186 39 155C43 120 76 95 91 19Z" fill="#FF6000"/><path d="M91 116C98 140 116 152 113 174C111 191 99 199 87 197C72 195 65 183 69 170C74 153 86 137 91 116Z" fill="#FFA559"/><path d="M89 161C91 174 101 179 98 188C96 195 85 197 81 189C77 181 87 169 89 161Z" fill="#FFE6C7"/></svg>
        <span className="specimen-number">01</span><p>Normal gravity</p><small>Buoyancy pulls hot gases upward</small>
      </div>
      <div className="flame-specimen">
        <svg viewBox="0 0 180 230" fill="none" aria-hidden="true"><circle cx="90" cy="141" r="65" fill="#FF6000"/><circle cx="90" cy="141" r="43" fill="#FFA559"/><circle cx="90" cy="141" r="19" fill="#FFE6C7"/><circle cx="90" cy="141" r="78" stroke="#FFA559" strokeOpacity=".35" strokeDasharray="2 6"/></svg>
        <span className="specimen-number">02</span><p>Microgravity</p><small>Reduced buoyancy changes the shape</small>
      </div>
    </div>
    <figcaption>Schematic illustration. Flame shape depends on fuel and flow.</figcaption>
  </figure>;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationList | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPending(true);
    setError("");
    Promise.allSettled([
      api<Stats>("/api/stats", { signal: controller.signal }),
      api<{ papers: Paper[] }>("/api/papers", { signal: controller.signal }),
      api<InvestigationList>("/api/investigations?limit=1", { signal: controller.signal }),
    ]).then(([s, p, i]) => {
      if (controller.signal.aborted) return;
      if (s.status === "fulfilled") setStats(s.value);
      if (p.status === "fulfilled") setPapers(p.value.papers.slice(0, 3));
      if (i.status === "fulfilled") setInvestigations(i.value);
      if ([s, p, i].some(r => r.status === "rejected")) setError("Some records could not be loaded. Try again to refresh the archive.");
      setPending(false);
    });
    return () => controller.abort();
  }, [revision]);

  const metrics = [
    { label: "Investigations", value: investigations?.total },
    { label: "NASA publications", value: stats?.papers },
    { label: "Searchable passages", value: stats?.chunks },
    { label: "Page-checked values", value: stats?.verified_measurements },
  ];

  return <div className="homepage">
    <section className="home-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">Combustion research / NASA archives</p>
        <h1 id="hero-title"><span>Fire behaves</span><span>differently</span><span className="fire-line">in free-fall.</span></h1>
        <p>Explore how flames spread in microgravity. Find experiments, compare reported measurements, and read the original NASA publications.</p>
        <div className="hero-ctas"><Link href="/investigations" className="primary-button">Explore investigations <span aria-hidden="true">&#8599;</span></Link><Link href="/research" className="secondary-button">Browse publications <span aria-hidden="true">&#8599;</span></Link></div>
        <a className="hero-scroll" href="#research-paths">Find your starting point <span aria-hidden="true">&#8595;</span></a>
      </div>
      <FlameComparison />
    </section>

    {error && <div className="mb-8"><Failure message={error} retry={() => setRevision(v => v + 1)} /></div>}
    <ResearchStatistics metrics={metrics} pending={pending} />

    <section id="research-paths" className="editorial-section" aria-labelledby="paths-title">
      <Reveal className="section-top"><p className="eyebrow">Research tools</p><h2 className="section-display" id="paths-title">Start with a question.</h2></Reveal>
      <div className="workflow-grid">{PATHS.map((w, index) => <Reveal key={w.href} className="workflow-panel" delay={index * 60}><span className="workflow-number" aria-hidden="true">{w.number}</span><h3><Link href={w.href}>{w.title}</Link></h3><p>{w.text}</p><Link className="workflow-link" href={w.href} aria-label={w.cta}>&#8599;</Link></Reveal>)}</div>
    </section>

    <ResearchTopics coverage={stats?.coverage} pending={pending} />

    <section className="editorial-section" aria-labelledby="archive-title"><Reveal>
      <div className="archive-heading"><div><p className="eyebrow">From the collection</p><h2 id="archive-title" className="section-display">Selected publications</h2></div><Link className="text-link" href="/research">View the archive <span aria-hidden="true">&#8599;</span></Link></div>
      {papers.map(p => <article key={p.paper_id} className="featured-paper"><div className="paper-year">{p.year ?? "Undated"}<small>{p.source.toUpperCase()}</small></div><div><h3><Link href={`/research/${encodeURIComponent(p.paper_id)}`}>{p.title}</Link></h3><p>{p.center ?? ""}{p.center ? " / " : ""}{p.paper_id}</p><p className="line-clamp-2">{p.abstract ?? "Open the publication to read the available record."}</p></div><Link href={`/research/${encodeURIComponent(p.paper_id)}`} aria-label={`Read ${p.title}`}>&#8599;</Link></article>)}
      {!papers.length && !pending && <p className="empty-state">No publications could be loaded. Try again above.</p>}
    </Reveal></section>

    <Reveal className="integrity-panel"><div><p className="eyebrow">About the collection</p><h2 className="section-title">Read the conditions<br />alongside the results.</h2></div><div className="integrity-copy"><p>Measurements apply to the fuel, atmosphere, and gravity conditions in each study. Reported observations and model results are labeled separately.</p><details><summary>Data availability and limitations</summary><ul>{(stats?.limitations ?? ["Raw experimental files require authorized import. Catalog descriptions are not measurements."]).map(l => <li key={l}>{l}</li>)}</ul><Link href="/sources" className="text-link">View sources <span aria-hidden="true">&#8599;</span></Link></details></div></Reveal>
  </div>;
}
