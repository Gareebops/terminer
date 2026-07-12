"use client";

import { useMemo, useState } from "react";

// Dnevnik akcija: server šalje poslednjih 200 (ranije se videlo samo 30 bez
// ikakvog puta do starijih), klijent filtrira i listа na "Prikaži još".
export interface AuditRow {
  id: string;
  atLabel: string;
  action: string;
  tenantLabel: string | null;
  details: string | null; // već stringifikovan JSON
}

const PAGE_SIZE = 30;

export function AuditLogList({ rows }: { rows: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.action, r.tenantLabel ?? "", r.details ?? "", r.atLabel].some((s) =>
        s.toLowerCase().includes(q)
      )
    );
  }, [rows, query]);

  const shown = filtered.slice(0, limit);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(PAGE_SIZE);
        }}
        placeholder="Traži po akciji, salonu, detaljima…"
        className="mt-4 h-10 w-full max-w-xs rounded-full border border-ink/15 bg-white px-4 text-sm font-medium"
        aria-label="Pretraga dnevnika akcija"
      />
      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-card">
        {shown.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink/5 px-4 py-2.5 text-sm last:border-0"
          >
            <span className="text-xs tabular-nums text-ink/70">{entry.atLabel}</span>
            <span className="font-bold">{entry.action}</span>
            {entry.tenantLabel && <span className="text-ink/70">{entry.tenantLabel}</span>}
            {entry.details && (
              <span className="truncate text-xs text-ink/70">{entry.details}</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="p-8 text-center text-ink/70">
            {rows.length === 0
              ? "Još nema zabeleženih akcija."
              : "Nijedan zapis ne odgovara pretrazi."}
          </p>
        )}
        {filtered.length > limit && (
          <button
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            className="w-full border-t border-ink/5 p-3 text-sm font-semibold text-ink/70 transition-colors hover:bg-ink/5"
          >
            Prikaži još ({filtered.length - limit})
          </button>
        )}
      </div>
    </div>
  );
}
