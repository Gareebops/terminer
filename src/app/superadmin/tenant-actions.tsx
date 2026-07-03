"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { extendSubscription, extendTrial, setPaidUntil } from "./actions";

export function TenantActions({
  tenantId,
  status,
  paidUntil,
}: {
  tenantId: string;
  status: string;
  paidUntil: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [dateOpen, setDateOpen] = useState(false);
  const [date, setDate] = useState(paidUntil ?? "");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(res.error ?? "Greška.");
    });
  }

  const pill =
    "rounded-full px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(status === "trial" || status === "grace" || status === "expired") && (
        <button
          disabled={pending}
          onClick={() => run(() => extendTrial(tenantId, 14), "Proba produžena 14 dana.")}
          className={`${pill} bg-lavender text-ink`}
          title="Produži probni period"
        >
          Proba +14d
        </button>
      )}
      {[1, 3, 12].map((m) => (
        <button
          key={m}
          disabled={pending}
          onClick={() =>
            run(() => extendSubscription({ tenantId, months: m }), `Produženo ${m} mes.`)
          }
          className={`${pill} bg-ink text-white`}
          title="Gratis/ručno produženje pretplate"
        >
          +{m} mes
        </button>
      ))}
      <button
        disabled={pending}
        onClick={() => setDateOpen((o) => !o)}
        className={`${pill} border border-ink/15 text-ink/70`}
        title="Ručno postavi datum isteka"
      >
        Datum…
      </button>
      {dateOpen && (
        <span className="flex items-center gap-1.5">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold"
          />
          <button
            disabled={pending || !date}
            onClick={() =>
              run(() => setPaidUntil(tenantId, date), "Datum isteka postavljen.")
            }
            className={`${pill} bg-mint text-ink`}
          >
            Sačuvaj
          </button>
        </span>
      )}
    </div>
  );
}
