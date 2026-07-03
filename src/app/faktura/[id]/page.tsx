import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { assertSuperAdmin } from "@/app/superadmin/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildIpsQr,
  formatAmount,
  invoiceLabel,
  ISSUER,
  PLANS,
  type Invoice,
} from "@/lib/invoice";
import { PrintButton } from "./print-button";

type InvoiceRow = Invoice & { tenants: { name: string; slug: string } | null };

async function loadInvoice(id: string): Promise<InvoiceRow | null> {
  // Član salona: kroz RLS; superadmin: kroz service role
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*, tenants(name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (data) return data as InvoiceRow;

  if (await assertSuperAdmin()) {
    const db = createAdminClient();
    const { data: row } = await db
      .from("invoices")
      .select("*, tenants(name, slug)")
      .eq("id", id)
      .maybeSingle();
    return (row as InvoiceRow) ?? null;
  }
  return null;
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const invoice = await loadInvoice(id);
  if (!invoice) notFound();

  const ipsString = buildIpsQr({
    amount: Number(invoice.amount),
    invoiceNumber: invoice.number,
    invoiceYear: invoice.year,
  });
  const qrDataUrl = await QRCode.toDataURL(ipsString, { margin: 1, width: 240 });

  const plan = PLANS[invoice.plan];
  const issued = new Date(invoice.created_at);
  const due = new Date(issued.getTime() + 7 * 86400000);
  const fmt = (d: string | Date) =>
    new Date(d).toLocaleDateString("sr-RS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const buyerLines = (invoice.buyer_info || invoice.tenants?.name || "")
    .split("\n")
    .filter(Boolean);
  const ro = `00${invoice.year}${String(invoice.number).padStart(3, "0")}`;

  return (
    <main className="min-h-screen bg-canvas p-4 font-display text-ink print:bg-white print:p-0 sm:p-10">
      <div className="mx-auto max-w-[210mm]">
        <div className="mb-4 flex justify-end gap-2 print:hidden">
          <PrintButton />
        </div>

        {/* A4 list */}
        <div className="rounded-2xl bg-white p-10 shadow-[0_4px_24px_rgba(20,25,20,0.08)] print:rounded-none print:p-6 print:shadow-none sm:p-14">
          {/* Zaglavlje */}
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-2xl font-extrabold tracking-tight">{ISSUER.name}</p>
              <p className="mt-1 text-sm text-ink/60">
                {ISSUER.address}, {ISSUER.city}
              </p>
              <p className="text-sm text-ink/60">
                PIB: {ISSUER.pib} · MB: {ISSUER.mb}
              </p>
              <p className="text-sm text-ink/60">
                {ISSUER.bank} · {ISSUER.account}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold tracking-tight">FAKTURA</p>
              <p className="mt-1 text-lg font-bold">br. {invoiceLabel(invoice)}</p>
              <div className="mt-3 inline-block text-center">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink/50">
                  NBS IPS QR
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="IPS QR kod za plaćanje" className="size-32" />
              </div>
            </div>
          </div>

          {/* Kupac i datumi */}
          <div className="mt-10 flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/50">
                Kupac
              </p>
              {buyerLines.map((line, i) => (
                <p key={i} className={i === 0 ? "mt-1 font-bold" : "text-sm text-ink/70"}>
                  {line}
                </p>
              ))}
            </div>
            <div className="text-sm">
              <p>
                <span className="text-ink/50">Datum izdavanja:</span>{" "}
                <span className="font-semibold">{fmt(issued)}</span>
              </p>
              <p>
                <span className="text-ink/50">Valuta plaćanja:</span>{" "}
                <span className="font-semibold">{fmt(due)}</span>
              </p>
              <p>
                <span className="text-ink/50">Mesto izdavanja:</span>{" "}
                <span className="font-semibold">Niš</span>
              </p>
            </div>
          </div>

          {/* Stavke */}
          <table className="mt-10 w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                <th className="py-2 font-bold">Opis</th>
                <th className="py-2 text-center font-bold">Kol.</th>
                <th className="py-2 text-right font-bold">Cena</th>
                <th className="py-2 text-right font-bold">Ukupno</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-ink/10">
                <td className="py-3">
                  <p className="font-semibold">
                    Terminer — {plan.label.toLowerCase()}
                  </p>
                  <p className="text-xs text-ink/50">
                    Salon: {invoice.tenants?.name} · period {fmt(invoice.period_from)} –{" "}
                    {fmt(invoice.period_to)}
                  </p>
                </td>
                <td className="py-3 text-center">1</td>
                <td className="py-3 text-right">{formatAmount(Number(invoice.amount))}</td>
                <td className="py-3 text-right font-semibold">
                  {formatAmount(Number(invoice.amount))}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <div className="w-56">
              <div className="flex justify-between border-b-2 border-ink py-2 text-base font-extrabold">
                <span>UKUPNO (RSD)</span>
                <span>{formatAmount(Number(invoice.amount))}</span>
              </div>
            </div>
          </div>

          {/* Instrukcije za plaćanje */}
          <div className="mt-10 rounded-xl bg-ink/[0.04] p-4 text-sm print:border print:border-ink/20">
            <p className="font-bold">Instrukcije za plaćanje</p>
            <p className="mt-1 text-ink/70">
              Skeniraj IPS QR kod iz svoje m-banking aplikacije, ili uplati na
              račun <span className="font-semibold">{ISSUER.account}</span>{" "}
              ({ISSUER.bank}), poziv na broj{" "}
              <span className="font-semibold">{ro}</span>, svrha: Terminer
              članarina.
            </p>
          </div>

          <p className="mt-10 text-center text-xs text-ink/40">
            Faktura je izdata elektronski i važi bez pečata i potpisa.
          </p>
        </div>
      </div>
    </main>
  );
}
