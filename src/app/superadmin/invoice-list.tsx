"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { InvoiceStatus } from "@/lib/invoice";
import { INVOICE_STATUS_LABELS } from "@/lib/invoice";
import { InvoiceActions } from "./invoice-actions";

// Serijalizovan red fakture - labele računa server (page.tsx).
export interface InvoiceRow {
  id: string;
  label: string; // "7/2026"
  tenantName: string; // ime salona ili tenant_label za obrisan salon
  tenantDeleted: boolean;
  planLabel: string;
  amountLabel: string; // "1.990,00"
  createdLabel: string;
  status: InvoiceStatus;
  paidAtLabel: string | null;
}

const invoiceStatusCls: Record<string, string> = {
  issued: "bg-amber-200 text-amber-950",
  paid: "bg-mint text-ink",
  cancelled: "bg-ink/10 text-ink/70",
};

const STATUS_FILTERS = [
  { id: "sve", label: "Sve" },
  { id: "issued", label: "Na čekanju" },
  { id: "paid", label: "Plaćene" },
  { id: "cancelled", label: "Stornirane" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

const PAGE_SIZE = 30;

export function InvoiceList({ rows }: { rows: InvoiceRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("sve");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "sve" && r.status !== status) return false;
      if (!q) return true;
      return (
        r.tenantName.toLowerCase().includes(q) || r.label.toLowerCase().includes(q)
      );
    });
  }, [rows, query, status]);

  const shown = filtered.slice(0, limit);

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder="Traži po salonu ili broju…"
          className="h-10 w-full max-w-xs rounded-full border border-ink/15 bg-white px-4 text-sm font-medium"
          aria-label="Pretraga faktura"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter faktura">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setStatus(f.id);
                setLimit(PAGE_SIZE);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-80 ${
                status === f.id ? "bg-ink text-white" : "bg-ink/10 text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {(query || status !== "sve") && (
          <span className="text-xs font-medium text-ink/70">
            {filtered.length} od {rows.length}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {shown.map((inv) => (
          <div
            key={inv.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-card"
          >
            <Link
              href={`/faktura/${inv.id}`}
              target="_blank"
              className="min-w-16 font-bold underline-offset-2 hover:underline"
            >
              {inv.label}
            </Link>
            <span className="min-w-32 text-sm font-semibold">
              {inv.tenantName}
              {inv.tenantDeleted && (
                <span className="ml-1.5 text-xs font-medium text-ink/50">
                  (salon obrisan)
                </span>
              )}
            </span>
            <span className="text-sm text-ink/70">
              {inv.planLabel} · {inv.amountLabel} RSD · {inv.createdLabel}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${invoiceStatusCls[inv.status]}`}
            >
              {INVOICE_STATUS_LABELS[inv.status]}
              {inv.paidAtLabel && ` ${inv.paidAtLabel}`}
            </span>
            <div className="ml-auto">
              <InvoiceActions invoiceId={inv.id} status={inv.status} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/70">
            {rows.length === 0
              ? "Još nema izdatih faktura."
              : "Nijedna faktura ne odgovara filteru."}
          </p>
        )}
        {filtered.length > limit && (
          <button
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            className="w-full rounded-2xl border border-dashed border-ink/20 p-3 text-sm font-semibold text-ink/70 transition-colors hover:bg-ink/5"
          >
            Prikaži još ({filtered.length - limit})
          </button>
        )}
      </div>
    </div>
  );
}
