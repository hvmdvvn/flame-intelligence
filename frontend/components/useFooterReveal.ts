"use client";

import { useLayoutEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Keep the scene anchored inside its own clipped, naturally sized scroll space. */
export function useFooterReveal(rootRef: RefObject<HTMLDivElement | null>, pathname: string) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    const scene = root?.querySelector<HTMLElement>(".signature-footer");
    const wordmark = root?.querySelector<HTMLElement>(".wordmark-stage");
    const curtain = document.querySelector<HTMLElement>(".page-curtain");
    if (!root || !scene || !wordmark) return;

    gsap.registerPlugin(ScrollTrigger);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    let context: gsap.Context | undefined;
    let frame = 0;
    let disposed = false;
    let keyboard = false;
    let previousLayout = "";

    function build() {
      if (disposed || !root || !scene || !wordmark) return;
      const height = scene.getBoundingClientRect().height;
      const headerHeight = document.querySelector(".site-header")?.clientHeight ?? 0;
      const layout = [height, wordmark.offsetTop, window.innerWidth, window.innerHeight,
        curtain?.offsetHeight, mobile.matches, reducedMotion.matches].join(":");
      if (layout === previousLayout) return;
      previousLayout = layout;
      context?.revert();
      root.dataset.footerMotion = keyboard ? "keyboard" : "reduced";
      if (reducedMotion.matches || keyboard) return;

      // Tall footers briefly anchor, then scroll normally so every link stays reachable.
      const fits = height <= window.innerHeight - headerHeight - 24;
      const distance = fits ? height : Math.min(window.innerHeight * 0.24, height * 0.22);
      root.dataset.footerMotion = fits ? "anchored" : "flow";
      context = gsap.context(() => {
        const columns = root.querySelectorAll(".footer-utility > *");
        const lettering = root.querySelectorAll(mobile.matches ? ".wordmark-ink" : ".wordmark-letter");
        const timeline = gsap.timeline({
          scrollTrigger: {
            id: "signature-footer-scene",
            trigger: root,
            start: "top bottom",
            end: fits ? "bottom bottom" : `+=${distance}`,
            scrub: true,
          },
        });

        // No pinning or added scroll distance. The clip edge acts as the curtain.
        timeline.fromTo(scene, { y: -distance }, { y: 0, duration: 1, ease: "none" }, 0);
        timeline.fromTo(columns, { y: mobile.matches ? 12 : 24, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.4, stagger: 0.065, ease: "power2.out",
        }, fits ? 0.38 : 0.1);

        const letterFrom = { yPercent: 112, scaleY: mobile.matches ? 0.96 : 0.84 };
        const letterTo = {
          yPercent: 0, scaleY: 1, ease: "power3.out",
          stagger: { amount: mobile.matches ? 0.06 : 0.16 },
        };
        if (fits) {
          timeline.fromTo(lettering, letterFrom, { ...letterTo, duration: 0.5 }, 0.02);
        } else {
          // Use flow coordinates, unaffected by the scene's temporary transform.
          gsap.fromTo(lettering, letterFrom, {
            ...letterTo,
            scrollTrigger: {
              id: "signature-footer-lettering",
              trigger: root,
              start: () => root.getBoundingClientRect().top + window.scrollY
                + wordmark.offsetTop - window.innerHeight * 0.94,
              end: () => root.getBoundingClientRect().top + window.scrollY
                + scene.offsetHeight - window.innerHeight - 8,
              scrub: true,
            },
          });
        }
      }, root);
      ScrollTrigger.refresh();
    }

    function scheduleBuild() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(build);
    }

    function onFocus(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(":focus-visible")) return;
      // Keyboard users must never have to tab through a masked or transparent link.
      keyboard = true;
      context?.revert();
      root!.dataset.footerMotion = "keyboard";
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => target.scrollIntoView({ block: "nearest", behavior: "instant" }));
    }

    build();
    const observer = new ResizeObserver(scheduleBuild);
    observer.observe(scene);
    if (curtain) observer.observe(curtain);
    window.addEventListener("resize", scheduleBuild);
    reducedMotion.addEventListener("change", scheduleBuild);
    mobile.addEventListener("change", scheduleBuild);
    root.addEventListener("focusin", onFocus);
    void document.fonts.ready.then(() => { if (!disposed) scheduleBuild(); });

    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleBuild);
      reducedMotion.removeEventListener("change", scheduleBuild);
      mobile.removeEventListener("change", scheduleBuild);
      root.removeEventListener("focusin", onFocus);
      context?.revert();
      delete root.dataset.footerMotion;
    };
  }, [rootRef, pathname]);
}
