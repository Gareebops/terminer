"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

// Brza akcija na Početnoj: kopira javni link sajta za slanje klijentima.
export function ShareSiteButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
      setCopied(true);
      toast.success("Link sajta je kopiran - nalepi ga u poruku ili na profil.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopiranje nije uspelo.");
    }
  }

  return (
    <button
      onClick={copy}
      // col-span-2/justify-center važe samo u mobilnoj mreži brzih akcija
      // na Početnoj (grid 2+1); u sm:flex redu su bez efekta
      className="col-span-2 flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-card transition-colors hover:bg-ink/5 sm:col-span-1 sm:justify-start"
    >
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      Podeli sajt
    </button>
  );
}
