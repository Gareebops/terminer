"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { plural } from "@/lib/plural";
import { AccountControls } from "./account-controls";
import { TenantActions } from "./tenant-actions";

// Serijalizovan red salona - server (page.tsx) računa sve labele i statuse,
// klijent samo filtrira i crta (bez hidratacionih razlika u datumima).
export interface SalonRow {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string | null;
  ownerConfirmed: boolean;
  suspended: boolean;
  suspendedReason: string | null;
  status: "trial" | "active" | "grace" | "expired";
  daysLeft: number;
  paidUntil: string | null;
  deadlineLabel: string; // "Plaćeno do ..." / "Proba do ..."
  isPublished: boolean;
  b30: number;
  b7: number;
  services: number;
  staff: number;
  lastSignInLabel: string | null;
  online: boolean;
  presenceLabel: string | null;
  customDomain: string | null;
  note: string | null;
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  trial: { label: "Proba", cls: "bg-lavender text-ink" },
  active: { label: "Aktivan", cls: "bg-mint text-ink" },
  grace: { label: "Grace", cls: "bg-amber-300 text-amber-950" },
  expired: { label: "Istekao", cls: "bg-red-600 text-white" },
};

const FILTERS = [
  { id: "svi", label: "Svi" },
  { id: "online", label: "Online" },
  { id: "trial", label: "Proba" },
  { id: "grace", label: "Grace" },
  { id: "expired", label: "Istekli" },
  { id: "active", label: "Aktivni" },
  { id: "suspended", label: "Suspendovani" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matchesFilter(row: SalonRow, filter: FilterId): boolean {
  if (filter === "svi") return true;
  if (filter === "online") return row.online;
  if (filter === "suspended") return row.suspended;
  return row.status === filter;
}

export function SalonList({ rows }: { rows: SalonRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("svi");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!matchesFilter(r, filter)) return false;
      if (!q) return true;
      return [r.name, r.slug, r.ownerEmail ?? "", r.customDomain ?? ""].some((s) =>
        s.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Traži po imenu, slugu, mejlu, domenu…"
          className="h-10 w-full max-w-xs rounded-full border border-ink/15 bg-white px-4 text-sm font-medium"
          aria-label="Pretraga salona"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter salona">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-80 ${
                filter === f.id ? "bg-ink text-white" : "bg-ink/10 text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {(query || filter !== "svi") && (
          <span className="text-xs font-medium text-ink/70">
            {filtered.length} od {rows.length}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((row) => {
          const s = statusLabels[row.status];
          return (
            <div key={row.id} className="rounded-2xl bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-44">
                  <p className="flex items-center gap-2 font-bold">
                    {row.name}
                    {row.online && (
                      <span
                        className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900"
                        title="Vlasnik/admin trenutno koristi admin panel"
                      >
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                        </span>
                        online
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink/70">
                    <Link href={`/${row.slug}`} target="_blank" className="hover:underline">
                      /{row.slug}
                    </Link>
                    {row.customDomain && (
                      <>
                        {" · "}
                        <a
                          href={`https://${row.customDomain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {row.customDomain}
                        </a>
                      </>
                    )}
                    {row.ownerEmail && (
                      <>
                        {" · "}
                        <a href={`mailto:${row.ownerEmail}`} className="hover:underline">
                          {row.ownerEmail}
                        </a>
                        {!row.ownerConfirmed && " · nalog nepotvrđen"}
                      </>
                    )}
                  </p>
                </div>
                {row.suspended && (
                  <span
                    className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white"
                    title={row.suspendedReason ?? undefined}
                  >
                    SUSPENDOVAN
                  </span>
                )}
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>
                  {s.label}
                  {row.status !== "expired" && ` · ${row.daysLeft}d`}
                </span>
                {/* Proba bez ijedne rezervacije = kandidat za javljanje
                    pre nego što istekne */}
                {row.status === "trial" && row.b30 === 0 && (
                  <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-950">
                    bez rezervacija
                  </span>
                )}
                <span className="text-xs font-medium text-ink/70">
                  {row.deadlineLabel}
                  {" · "}
                  {row.isPublished ? "objavljen" : "neobjavljen"}
                </span>
              </div>
              {row.suspended && row.suspendedReason && (
                <p className="mt-2 text-xs font-semibold text-red-700">
                  Razlog suspenzije: {row.suspendedReason}
                </p>
              )}
              <p className="mt-2 text-xs font-medium text-ink/70">
                {row.b30} {plural(row.b30, ["rezervacija", "rezervacije", "rezervacija"])}{" "}
                u 30 dana ({row.b7} u 7) · {row.services}{" "}
                {plural(row.services, ["usluga", "usluge", "usluga"])} · {row.staff}{" "}
                {plural(row.staff, ["član", "člana", "članova"])} tima · vlasnik
                prijavljen {row.lastSignInLabel ?? "nikad"}
                {row.presenceLabel && !row.online && ` · u panelu ${row.presenceLabel}`}
              </p>
              {row.note && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
                  <span className="font-bold">Beleška:</span> {row.note}
                </p>
              )}
              <div className="mt-3 border-t border-ink/5 pt-3">
                <TenantActions
                  tenantId={row.id}
                  status={row.status}
                  paidUntil={row.paidUntil}
                />
              </div>
              <div className="mt-2 border-t border-ink/5 pt-2">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink/70">
                  Nalog
                </p>
                <AccountControls
                  tenantId={row.id}
                  slug={row.slug}
                  suspended={row.suspended}
                  ownerConfirmed={row.ownerConfirmed}
                  customDomain={row.customDomain}
                  note={row.note}
                />
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/70">
            {rows.length === 0
              ? "Još nema salona."
              : "Nijedan salon ne odgovara pretrazi."}
          </p>
        )}
      </div>
    </div>
  );
}
