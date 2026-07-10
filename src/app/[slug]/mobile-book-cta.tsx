"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Plutajuće "Zakaži termin" na dnu ekrana (samo telefon): pojavi se kad
// hero CTA ode van vidika, da poziv na akciju uvek bude na dohvat palca.
export function MobileBookCta({ slug }: { slug: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-transform duration-300 sm:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Button asChild size="lg" className="h-12 w-full text-base shadow-xl">
        <Link href={`/${slug}/zakazi`}>Zakaži termin</Link>
      </Button>
    </div>
  );
}
