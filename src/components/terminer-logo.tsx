import Link from "next/link";

// Terminer logo: znak iz favicona (ink pločica + mint T) + wordmark.
// Radi i u server i u klijent komponentama (nema hook-ova).
export function TerminerMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#17181A" />
      <rect x="15" y="16" width="34" height="10" rx="5" fill="#A6F5A6" />
      <rect x="27" y="16" width="10" height="32" rx="5" fill="#A6F5A6" />
    </svg>
  );
}

export function TerminerLogo({ href }: { href?: string }) {
  const inner = (
    <>
      <TerminerMark />
      <span className="text-xl font-extrabold tracking-tight text-ink">
        Terminer
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="flex items-center gap-2.5">
        {inner}
      </Link>
    );
  }
  return <span className="flex items-center gap-2.5">{inner}</span>;
}
