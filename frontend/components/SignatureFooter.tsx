"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { useFooterReveal } from "@/components/useFooterReveal";

export function SignatureFooter() {
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useFooterReveal(root, pathname);

  return <div ref={root} className="footer-reveal">
  <footer className="signature-footer">
    <div className="container-wide">
      <div className="footer-utility">
        <div className="footer-about">
          <Link href="/" className="footer-brand">Flame Intelligence<span aria-hidden="true">.</span></Link>
          <p>An independent collection of NASA combustion research and source data.</p>
          <div className="footer-fineprint"><p>&copy; {new Date().getFullYear()} Flame Intelligence</p><p>Not affiliated with NASA. Research use only; no fire-safety certification.</p></div>
        </div>
        <nav aria-label="Footer navigation"><p className="footer-nav-label">Research</p><Link href="/investigations">Investigations</Link><Link href="/research">Publications</Link><Link href="/compare">Compare studies</Link><Link href="/ask">Research assistant</Link></nav>
        <nav aria-label="More research tools"><p className="footer-nav-label">Resources</p><Link href="/analytics">Research data</Link><Link href="/missions">Mission workspace</Link><Link href="/sources">Sources &amp; context</Link><a className="back-top" href="#top">Back to top <span aria-hidden="true">&#8593;</span></a></nav>
      </div>
    </div>
    <div className="wordmark-stage">
      <p className="signature-wordmark" role="img" aria-label="fire in free-fall">
        {["fire in ", "free-fall"].map((line, lineIndex) =>
          <span className="wordmark-line" key={lineIndex} aria-hidden="true"><span className="wordmark-ink">
            {Array.from(line).map((letter, index) => letter === " " ? " " :
              <span className="wordmark-letter" key={index}>{letter}</span>)}
          </span></span>)}
      </p>
    </div>
  </footer>
  </div>;
}
