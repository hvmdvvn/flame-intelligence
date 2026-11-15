"use client";

import { useEffect, useRef } from "react";

/** Content stays visible without JavaScript; motion only enhances offscreen sections. */
export function Reveal({children, className = "", delay = 0}: {children: React.ReactNode; className?: string; delay?: number}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;
    element.dataset.reveal = "pending";
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        element.dataset.reveal = "visible";
        observer.disconnect();
      }
    }, {threshold: 0.06, rootMargin: "0px 0px 40px 0px"});
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{transitionDelay: `${delay}ms`}}>{children}</div>;
}
