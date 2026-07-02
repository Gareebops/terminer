"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { extendSubscription } from "./actions";

const OPTIONS = [
  { months: 1, label: "+1 mes" },
  { months: 3, label: "+3 mes" },
  { months: 12, label: "+12 mes" },
];

export function ExtendButtons({ tenantId }: { tenantId: string }) {
  const [pending, startTransition] = useTransition();

  function extend(months: number) {
    startTransition(async () => {
      const res = await extendSubscription({ tenantId, months });
      if (res.ok) toast.success(`Produženo za ${months} mes.`);
      else toast.error(res.error ?? "Greška.");
    });
  }

  return (
    <div className="flex gap-1.5">
      {OPTIONS.map((o) => (
        <button
          key={o.months}
          disabled={pending}
          onClick={() => extend(o.months)}
          className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
