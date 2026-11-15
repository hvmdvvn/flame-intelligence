"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { SignatureFooter } from "@/components/SignatureFooter";

const LINKS = [
  {href:"/",label:"Overview"}, {href:"/investigations",label:"Investigations"},
  {href:"/research",label:"Publications"}, {href:"/compare",label:"Comparison"},
  {href:"/analytics",label:"Analytics"}, {href:"/ask",label:"Research assistant"},
  {href:"/missions",label:"Mission workspace"}, {href:"/sources",label:"Sources & context"},
];

function ThemeSwitch() {
  const [theme,setTheme] = useState("daylight");
  useEffect(() => {
    const sync=() => setTheme(document.documentElement.dataset.theme ?? "daylight");
    sync();
    window.addEventListener("flame-theme-change",sync);
    return () => window.removeEventListener("flame-theme-change",sync);
  },[]);
  return <label className="theme-control"><span>Theme</span><select aria-label="Theme" value={theme} onChange={event => {
    setTheme(event.target.value); document.documentElement.dataset.theme=event.target.value;
    try { localStorage.setItem("flame-theme-v2",event.target.value); } catch { /* Preferences remain usable without storage. */ }
    window.dispatchEvent(new Event("flame-theme-change"));
  }}><option value="daylight">Cream</option><option value="ember">Charcoal</option></select></label>;
}

export function Mark() {
  return <svg width="36" height="40" viewBox="0 0 36 40" aria-hidden="true" className="brand-mark">
    <path d="M19 2C20 13 31 17 29 28c-1 7-6 11-13 10C6 37 3 30 6 23c2-5 8-9 13-21Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M19 16c0 5 7 8 5 13-1 4-7 5-10 2-4-5 3-10 5-15Z" fill="currentColor" />
    <ellipse cx="18" cy="24" rx="17" ry="6" transform="rotate(-27 18 24)" fill="none" stroke="currentColor" strokeWidth=".8" />
  </svg>;
}

export function Shell({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  const [status,setStatus]=useState("Connecting to the research corpus");
  const [menuOpen,setMenuOpen]=useState(false);
  const menu=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active=true;
    api<{papers:number;corpus_version:string}>("/api/health").then(h => {if(active) setStatus(`${h.papers} publications · corpus ${h.corpus_version.slice(0,10)}`);}).catch(() => {if(active) setStatus("Research service unavailable");});
    return () => {active=false;};
  },[pathname]);
  useEffect(() => {setMenuOpen(false);},[pathname]);
  useEffect(() => {
    const dialog=menu.current;
    if(!dialog) return;
    if(menuOpen && !dialog.open) dialog.showModal();
    if(!menuOpen && dialog.open) dialog.close();
    if(!menuOpen) return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onResize=() => {if(window.innerWidth>=1400) setMenuOpen(false);};
    window.addEventListener("resize",onResize);
    return () => {document.body.style.overflow=previous;window.removeEventListener("resize",onResize);};
  },[menuOpen]);
  function navigation(mobile=false) {
    return LINKS.map((link,index) => <Link key={link.href} href={link.href} aria-current={pathname===link.href || (link.href!=="/" && pathname.startsWith(link.href)) ? "page" : undefined} onClick={() => setMenuOpen(false)}>
      {mobile && <span className="nav-number" aria-hidden="true">0{index+1}</span>}<span>{link.label}</span>{mobile && <span className="nav-arrow" aria-hidden="true">↗</span>}
    </Link>);
  }
  return <div id="top" className="app-shell">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <header className="site-header"><div className="header-inner">
      <Link href="/" className="brand" title="Home"><Mark /><span><strong>Flame Intelligence</strong><small>Fire in Free-Fall</small></span></Link>
      <nav className="desktop-navigation" aria-label="Main navigation">{navigation()}</nav>
      <div className="header-tools"><div className="desktop-theme"><ThemeSwitch /></div><button ref={trigger} className="menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(true)}><span>Menu</span><span className="menu-lines" aria-hidden="true"><i /><i /></span></button></div>
    </div></header>
    <dialog ref={menu} id="mobile-navigation" aria-label="Site navigation" className="mobile-navigation" onClose={() => {setMenuOpen(false);trigger.current?.focus();}} onClick={e => {if(e.target===e.currentTarget) setMenuOpen(false);}}>
      <div className="mobile-menu-top"><p className="eyebrow">Fire in Free-Fall</p><button className="icon-button" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>×</button></div>
      <nav aria-label="Main navigation">{navigation(true)}</nav><div className="mobile-menu-bottom"><ThemeSwitch /><p>{status}</p></div>
    </dialog>
    <div className="page-curtain"><main id="main-content" className="page-shell container-wide" tabIndex={-1}>{children}</main></div>
    <SignatureFooter />
  </div>;
}

export function Loading({label}:{label:string}) {
  return <div role="status" aria-live="polite" className="loading-state"><p><span className="status-light" />{label}</p><div className="loading-skeleton" /><div className="loading-skeleton short" /></div>;
}

export function Failure({message,retry}:{message:string;retry?:()=>void}) {
  return <div className="failure-state" role="alert"><span className="eyebrow">Research service</span><p className="section-title">Unable to load this result</p><p>{message}</p>{retry && <button className="secondary-button" type="button" onClick={retry}>Try again <span aria-hidden="true">↗</span></button>}</div>;
}

export function Highlighted({text,quote}:{text:string;quote?:string}) {
  if(!quote) return <>{text}</>;
  const at=text.indexOf(quote);
  if(at<0) return <>{text}</>;
  return <>{text.slice(0,at)}<mark className="quote">{text.slice(at,at+quote.length)}</mark>{text.slice(at+quote.length)}</>;
}
