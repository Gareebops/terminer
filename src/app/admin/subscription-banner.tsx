"use client";

import { useState } from "react";
import { plural } from "@/lib/plural";
import { PaymentModal } from "./payment-modal";

// Baner o statusu pretplate - "visi nad glavom" dok se ne plati.
// CTA otvara modal sa QR kodom umesto da vodi u podešavanja.
export function SubscriptionBanner({
  status,
  daysLeft,
}: {
  status: string;
  daysLeft: number;
}) {
  const [payOpen, setPayOpen] = useState(false);

  if (status === "active") return null;

  const styles: Record<string, string> = {
    trial: "bg-lavender text-ink",
    grace: "bg-amber-400 text-amber-950",
    expired: "bg-red-600 text-white",
  };
  const text: Record<string, string> = {
    trial: `Probni period - još ${daysLeft} ${plural(daysLeft, ["dan", "dana", "dana"])} besplatnog korišćenja.`,
    grace: `Pretplata je istekla - online zakazivanje se pauzira za ${daysLeft} ${plural(daysLeft, ["dan", "dana", "dana"])}.`,
    expired:
      "Pretplata je istekla i online zakazivanje je pauzirano. Tvoj sajt je i dalje aktivan.",
  };

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-5 py-3 text-sm font-semibold ${styles[status]}`}
    >
      <span>{text[status]}</span>
      <button
        onClick={() => setPayOpen(true)}
        className="rounded-full bg-black/10 px-4 py-1.5 text-xs font-bold underline-offset-2 hover:underline"
      >
        Plati članarinu →
      </button>
      <PaymentModal
        open={payOpen}
        onOpenChange={setPayOpen}
        defaultPlan={status === "trial" ? "yearly" : "monthly"}
      />
    </div>
  );
}
