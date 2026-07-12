"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatAmount, PLANS, type PlanId } from "@/lib/invoice";
import { extendSubscription, extendTrial, issueInvoice, setPaidUntil } from "./actions";

// Srpski unos iznosa: "1.990", "1.990,00" i "1990.50" moraju značiti ono
// što Mihajlo vidi - Number("1.990") bi tiho dao 1,99 RSD! Tačke su
// separator hiljada kad postoji zapeta ili kad iza svake idu tačno 3
// cifre; inače je tačka decimalni zarez. null = prazno (cenovnik).
export function parseSrIznos(raw: string): number | null {
  let s = raw.trim().replace(/\s+/g, "").replace(/rsd$/i, "");
  if (!s) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  return Number(s);
}

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
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [plan, setPlan] = useState<PlanId>("monthly");
  const [amount, setAmount] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
    });
  }

  function submitInvoice() {
    const parsedAmount = parseSrIznos(amount);
    const custom = parsedAmount === null ? undefined : parsedAmount;
    if (custom !== undefined && (!Number.isFinite(custom) || custom <= 0)) {
      toast.error("Iznos mora biti pozitivan broj (prazan = cenovnik).");
      return;
    }
    // Potvrda sa PARSIRANIM iznosom - da "1.990" nikad tiho ne postane
    // faktura na 1,99 RSD
    if (
      custom !== undefined &&
      !confirm(`Izdati fakturu na ${formatAmount(custom)} RSD?`)
    ) {
      return;
    }
    startTransition(async () => {
      const res = await issueInvoice({ tenantId, plan, amount: custom });
      if (!res.ok) {
        toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
        return;
      }
      toast.success(
        res.reused
          ? "Aktivna faktura za taj period već postoji - nova nije izdata."
          : "Faktura je izdata."
      );
      setInvoiceOpen(false);
      setAmount("");
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
        onClick={() => setInvoiceOpen((o) => !o)}
        className={`${pill} bg-mint text-ink`}
        title="Izdaj fakturu umesto vlasnika (telefonski dogovor, founder cena)"
      >
        Izdaj fakturu…
      </button>
      {invoiceOpen && (
        <span className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(PLANS) as PlanId[]).map((p) => (
            <button
              key={p}
              disabled={pending}
              onClick={() => setPlan(p)}
              className={`${pill} ${
                plan === p ? "bg-ink text-white" : "border border-ink/15 text-ink/70"
              }`}
            >
              {p === "monthly" ? "Mesečna" : "Godišnja"}
            </button>
          ))}
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`${formatAmount(PLANS[plan].amount)} RSD`}
            title="Prilagođen iznos (prazan = cenovnik)"
            className="w-32 rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold"
          />
          {/* Živi pregled parsiranog iznosa - "1.990" se ovde odmah vidi
              kao 1.990,00 RSD (ili kao greška), pre klika na Izdaj */}
          {amount.trim() !== "" && (
            <span className="text-xs font-semibold text-ink/70">
              {(() => {
                const n = parseSrIznos(amount);
                return n !== null && Number.isFinite(n) && n > 0
                  ? `= ${formatAmount(n)} RSD`
                  : "neispravan iznos";
              })()}
            </span>
          )}
          <button
            disabled={pending}
            onClick={submitInvoice}
            className={`${pill} bg-mint text-ink`}
          >
            Izdaj
          </button>
        </span>
      )}
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
