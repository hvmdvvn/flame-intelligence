"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  r: number;
  p: number;
  s: number;
  spike: boolean;
};

export function Sky({
  density = 80,
  spiked = false,
  className = "",
}: {
  density?: number;
  spiked?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stars: Star[] = Array.from({ length: density }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * (spiked ? 1.6 : 1.05) + 0.25,
      p: Math.random() * Math.PI * 2,
      s: 0.35 + Math.random() * 1.4,
      spike: spiked && index < 5,
    }));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        frame = window.requestAnimationFrame(draw);
        return;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const nextW = Math.floor(width * dpr);
      const nextH = Math.floor(height * dpr);
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const theme = document.documentElement.dataset.theme;
      const ink = theme === "daylight" && !spiked ? "48, 34, 24" : "244, 236, 220";
      const mx = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mx")) || width / 2;
      const my = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--my")) || height / 3;
      const shiftX = reduce ? 0 : (mx / window.innerWidth - 0.5) * 22;
      const shiftY = reduce ? 0 : (my / window.innerHeight - 0.5) * 14;

      for (const star of stars) {
        const twinkle = reduce ? 0.75 : 0.35 + Math.sin(time * 0.001 * star.s + star.p) * 0.45;
        const x = star.x * width + shiftX * star.r;
        const y = star.y * height + shiftY * star.r;
        if (star.spike) {
          ctx.globalAlpha = twinkle * 0.55;
          ctx.strokeStyle = `rgb(${ink})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x - star.r * 7, y);
          ctx.lineTo(x + star.r * 7, y);
          ctx.moveTo(x, y - star.r * 7);
          ctx.lineTo(x, y + star.r * 7);
          ctx.stroke();
        }
        ctx.globalAlpha = Math.max(0.15, twinkle);
        ctx.fillStyle = `rgb(${ink})`;
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce) frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [density, spiked]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

export function Cupola() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <Sky spiked density={170} className="absolute inset-0 h-full w-full" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
        <ellipse cx="860" cy="300" rx="250" ry="92" fill="none" stroke="rgba(244,236,220,0.16)" strokeDasharray="3 8" />
        <ellipse cx="860" cy="300" rx="170" ry="58" fill="none" stroke="rgba(126,182,255,0.28)" />
        <path d="M40 120 H180 M40 120 V200" fill="none" stroke="rgba(244,236,220,0.28)" strokeWidth="1.2" />
        <path d="M1160 120 H1020 M1160 120 V200" fill="none" stroke="rgba(244,236,220,0.28)" strokeWidth="1.2" />
        <path d="M40 560 H180 M40 560 V480" fill="none" stroke="rgba(244,236,220,0.18)" strokeWidth="1.2" />
        <path d="M1160 560 H1020 M1160 560 V480" fill="none" stroke="rgba(244,236,220,0.18)" strokeWidth="1.2" />
      </svg>
      <span className="sat" />
      <div className="limb" />
      <div className="sample-float absolute right-[6%] top-[8%] hidden w-56 lg:block xl:right-[10%] xl:w-64">
        <SampleFrame />
      </div>
      <div className="hero-fade" />
    </div>
  );
}

export function SampleFrame() {
  return (
    <div className="relative">
      <svg viewBox="0 0 240 300" className="h-auto w-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]">
        <rect x="96" y="36" width="8" height="34" fill="#d9cbb8" />
        <rect x="136" y="36" width="8" height="34" fill="#d9cbb8" />
        <rect x="78" y="18" width="84" height="22" rx="2" fill="none" stroke="#f4ece0" strokeWidth="1.4" />
        <rect x="70" y="68" width="100" height="168" rx="3" fill="#241910" stroke="#f4ece0" strokeWidth="1.2" />
        <rect x="82" y="82" width="76" height="140" fill="#c24b28" />
        <path d="M82 150 h76" stroke="#7a2a16" strokeWidth="3" opacity="0.7" />
        <g className="flame">
          <path
            d="M82 118c-28 8-38 36-30 62 6 18 22 24 34 16 4-18 10-28 8-46-2-16-6-26-12-32z"
            fill="#ffb15a"
          />
          <path d="M70 146c-12 8-16 22-10 34 6 8 14 8 16-2 2-12 2-20-6-32z" fill="#fff1cf" opacity="0.9" />
        </g>
        <circle className="ember-bit" cx="48" cy="168" r="2.2" fill="#ffb15a" />
        <circle className="ember-bit ember-bit-late" cx="40" cy="198" r="1.5" fill="#fff1cf" />
        <circle className="ember-bit ember-bit-later" cx="54" cy="214" r="1.4" fill="#e85c24" />
      </svg>
      <p className="mt-2 text-center font-mono text-[10px] tracking-[0.18em] text-[#f4ece0]/75">
        DRAWING · NOT A PHOTOGRAPH
      </p>
    </div>
  );
}

export function FooterOrbit() {
  return (
    <div className="relative h-28">
      <svg viewBox="0 0 220 120" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <ellipse cx="110" cy="64" rx="86" ry="30" fill="none" stroke="rgba(244,236,220,0.35)" />
        <ellipse cx="110" cy="64" rx="48" ry="16" fill="none" stroke="rgba(126,182,255,0.45)" />
        <circle cx="110" cy="64" r="10" fill="#14365c" stroke="#7eb6ff" strokeWidth="1.4" />
        <path d="M20 96 Q110 78 200 96" fill="none" stroke="rgba(126,182,255,0.7)" strokeWidth="2" />
      </svg>
      <span className="footer-sat" />
    </div>
  );
}
