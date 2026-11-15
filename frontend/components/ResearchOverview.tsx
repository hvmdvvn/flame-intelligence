"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import type { Stats } from "@/lib/types";

type Metric = { label: string; value: number | undefined };
type AnimationKind = "statistics" | "topics";

function useOverviewReveal(
  rootRef: RefObject<HTMLElement | null>, ready: boolean, signature: string, kind: AnimationKind,
) {
  const completed = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !ready) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const counters = [...root.querySelectorAll<HTMLElement>("[data-count-to]")];
    const restoreCounts = () => counters.forEach(node => { node.textContent = node.dataset.countTo!; });
    if (completed.current || motion.matches) {
      completed.current = true;
      restoreCounts();
      root.dataset.animation = motion.matches ? "reduced" : "complete";
      return;
    }

    let observer: IntersectionObserver | undefined;
    let timeline: gsap.core.Timeline;
    root.dataset.animation = "waiting";
    const context = gsap.context(() => {
      timeline = gsap.timeline({
        paused: true,
        onStart: () => { root.dataset.animation = "running"; },
        onComplete: () => {
          completed.current = true;
          restoreCounts();
          root.dataset.animation = "complete";
        },
      });
      counters.forEach(node => { node.textContent = "0"; });

      if (kind === "statistics") {
        timeline.fromTo(root.querySelector(".metric-band"), { y: 28, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.7, ease: "power3.out",
        }, 0);
        timeline.fromTo(root.querySelectorAll(".metric-item"), { y: 20, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.55, stagger: 0.11, ease: "power3.out",
        }, 0.15);
        timeline.fromTo(root.querySelectorAll("dt"), { y: 6, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.45, stagger: 0.11, ease: "power2.out",
        }, 0.3);
      } else {
        timeline.fromTo(root.querySelector(".topics-grid"), { y: 36, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
        }, 0);
        timeline.fromTo(root.querySelector(".eyebrow"), { y: 10, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.5, ease: "power2.out",
        }, 0.15);
        timeline.fromTo(root.querySelectorAll(".topic-title-line"), { yPercent: 112 }, {
          yPercent: 0, duration: 0.75, stagger: 0.1, ease: "power3.out",
        }, 0.25);
        timeline.fromTo(root.querySelectorAll(".topics-description, .topics-intro .text-link"), { y: 14, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.55, stagger: 0.1, ease: "power2.out",
        }, 0.45);
        const rows = root.querySelectorAll(".topic-list li");
        if (rows.length) {
          timeline.fromTo(rows, { y: 16, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.5, stagger: 0.045, ease: "power3.out",
          }, 0.55);
          timeline.fromTo(root.querySelectorAll(".topic-fill"), { scaleX: 0 }, {
            scaleX: 1, duration: 1.25, stagger: 0.045, ease: "power3.out",
          }, 0.65);
        }
      }

      counters.forEach((node, index) => {
        const counter = { value: 0 };
        let previous = -1;
        timeline.to(counter, {
          value: Number(node.dataset.countTo),
          duration: kind === "statistics" ? 1.8 : 1.25,
          ease: "power3.out",
          onUpdate: () => {
            const integer = Math.floor(counter.value);
            if (integer !== previous) node.textContent = String(integer);
            previous = integer;
          },
        }, kind === "statistics" ? 0.25 + index * 0.11 : 0.65 + index * 0.045);
      });
    }, root);

    function finish() {
      observer?.disconnect();
      if (completed.current) return;
      timeline.progress(1);
    }
    function onFocus(event: FocusEvent) {
      if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) finish();
    }
    function onMotionChange() {
      if (!motion.matches) return;
      finish();
      context.revert();
      restoreCounts();
      completed.current = true;
      root!.dataset.animation = "reduced";
    }

    if (root.getBoundingClientRect().bottom <= 0 || !("IntersectionObserver" in window)) {
      finish();
    } else {
      const threshold = kind === "statistics" ? 0.3 : 0.12;
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= threshold)) {
          observer?.disconnect();
          timeline.play();
        }
      }, { threshold });
      observer.observe(root);
    }
    root.addEventListener("focusin", onFocus);
    motion.addEventListener("change", onMotionChange);
    return () => {
      observer?.disconnect();
      root.removeEventListener("focusin", onFocus);
      motion.removeEventListener("change", onMotionChange);
      context.revert();
      restoreCounts();
      delete root.dataset.animation;
    };
  }, [rootRef, ready, signature, kind]);
}

export function ResearchStatistics({ metrics, pending }: { metrics: Metric[]; pending: boolean }) {
  const root = useRef<HTMLElement>(null);
  useOverviewReveal(root, !pending, JSON.stringify(metrics), "statistics");

  return <section ref={root} className="research-statistics" aria-label="Research statistics">
    <dl className="metric-band" aria-label="Current research corpus" aria-busy={pending}>
      {metrics.map(metric => {
        const value = metric.value ?? (pending ? "..." : "N/A");
        return <div className="metric-item" key={metric.label}>
          <dt>{metric.label}</dt>
          <dd><span className="sr-only">{value}</span><span className="metric-number" aria-hidden="true" data-count-to={metric.value}>{value}</span></dd>
        </div>;
      })}
    </dl>
  </section>;
}

export function ResearchTopics({ coverage, pending }: { coverage?: Stats["coverage"]; pending: boolean }) {
  const root = useRef<HTMLElement>(null);
  const maxCoverage = Math.max(1, ...(coverage?.map(topic => topic.papers) ?? []));
  useOverviewReveal(root, !pending, JSON.stringify(coverage), "topics");

  return <section ref={root} className="editorial-section research-topics" aria-labelledby="topics-title">
    <div className="topics-grid">
      <div className="topics-intro">
        <p className="eyebrow">In the archive</p>
        <h2 id="topics-title" className="section-display"><span className="topic-title-mask"><span className="topic-title-line">Research</span></span>{" "}<span className="topic-title-mask"><span className="topic-title-line">by topic</span></span></h2>
        <p className="topics-description">Publications mentioning each topic in their title, abstract, or keywords.</p>
        <Link className="text-link" href="/research">Browse all publications <span aria-hidden="true">&#8599;</span></Link>
      </div>
      <div className="topics-data" aria-busy={pending}>
        {pending && !coverage ? <div className="topic-placeholder" role="status"><span className="sr-only">Loading research topics</span>{Array.from({ length: 9 }, (_, index) => <div key={index} aria-hidden="true"><span /><span /><span /></div>)}</div>
          : coverage ? <ul className="topic-list">{coverage.map(topic => <li key={topic.term}>
            <Link href={`/research?q=${encodeURIComponent(topic.term)}`}>
              <span className="topic-name">{topic.term}</span>
              <span className="topic-track" aria-hidden="true"><span className="topic-fill" style={{ width: `${topic.papers / maxCoverage * 100}%` }} /></span>
              <span className="topic-count"><span aria-hidden="true" data-count-to={topic.papers}>{topic.papers}</span><span className="sr-only">{topic.papers} publications</span></span>
            </Link>
          </li>)}</ul>
            : <p className="empty-state">Research topics are unavailable. Try again above.</p>}
      </div>
    </div>
  </section>;
}
