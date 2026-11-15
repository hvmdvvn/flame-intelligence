import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-[0.18em] text-ember">404</p>
      <h1 className="mt-3 font-serif text-5xl">Page not found</h1>
      <Link href="/" className="mt-6 inline-block font-mono text-xs tracking-[0.16em] text-ember">
        Return to overview
      </Link>
    </div>
  );
}
