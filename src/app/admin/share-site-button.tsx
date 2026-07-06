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
      className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-[0_4px_24px_rgba(20,25,20,0.06)] transition-colors hover:bg-ink/5"
    >
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      Podeli sajt
    </button>
  );
}
