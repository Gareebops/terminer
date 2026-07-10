"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cancelInvoice, markInvoicePaid } from "./actions";

export function InvoiceActions({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
    });
  }

  return (
    <div className="flex gap-1.5">
      <button
        disabled={pending}
        onClick={() =>
          run(() => markInvoicePaid(invoiceId), "Plaćeno - pretplata produžena.")
        }
        className="rounded-full bg-mint px-3 py-1.5 text-xs font-bold text-ink transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        Označi plaćeno
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm("Stornirati fakturu?")) return;
          run(() => cancelInvoice(invoiceId), "Faktura stornirana.");
        }}
        className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink/70 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
      >
        Storno
      </button>
    </div>
  );
}
