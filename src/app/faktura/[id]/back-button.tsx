"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Faktura se najčešće otvara u novom tabu (target="_blank"), gde nema
// istorije za "nazad". Zato: ako postoji istorija - vrati se; ako je tab
// tek otvoren - zatvori ga; ako ni to ne uspe - odvedi na fallback stranicu.
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    window.close();
    // Ako se tab ne zatvori (nije ga otvorio skript), idemo na fallback
    router.push(fallbackHref);
  }

  return (
    <button
      onClick={goBack}
      className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-ink/5"
    >
      <ArrowLeft className="size-4" />
      Nazad
    </button>
  );
}
