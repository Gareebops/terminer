"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatAmount,
  invoiceLabel,
  INVOICE_STATUS_LABELS,
  PLANS,
  type Invoice,
} from "@/lib/invoice";
import type { SubscriptionInfo } from "@/lib/billing";
import { plural } from "@/lib/plural";
import { updateBillingInfo } from "../actions";
import { PaymentModal } from "../payment-modal";

const statusText: Record<string, string> = {
  trial: "Probni period",
  active: "Aktivna pretplata",
  grace: "Istekla - grace period",
  expired: "Istekla",
};

export function PretplataClient({
  sub,
  paidUntil,
  trialEndsAt,
  billingInfo,
  invoices,
}: {
  sub: SubscriptionInfo;
  paidUntil: string | null;
  trialEndsAt: string;
  billingInfo: string;
  invoices: Invoice[];
}) {
  const [info, setInfo] = useState(billingInfo);
  const [payOpen, setPayOpen] = useState(false);
  const [, startTransition] = useTransition();

  function saveInfo() {
    startTransition(async () => {
      const res = await updateBillingInfo(info);
      if (res.ok) toast.success("Podaci za fakturu su sačuvani.");
      else toast.error(res.error ?? "Greška.");
    });
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("sr-RS");

  return (
    <div className="space-y-6">
      {/* Status + akcija plaćanja */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${
                  sub.status === "active"
                    ? "bg-mint text-ink"
                    : sub.status === "trial"
                      ? "bg-lavender text-ink"
                      : "bg-red-100 text-red-900"
                }`}
              >
                {statusText[sub.status]}
              </span>
              <span className="text-sm font-medium text-ink/60">
                {sub.status === "active" && paidUntil
                  ? `plaćeno do ${fmt(paidUntil)}`
                  : sub.status === "trial"
                    ? `još ${sub.daysLeft} ${plural(sub.daysLeft, ["dan", "dana", "dana"])} besplatno (do ${fmt(trialEndsAt)})`
                    : sub.status === "grace"
                      ? `zakazivanje se pauzira za ${sub.daysLeft} ${plural(sub.daysLeft, ["dan", "dana", "dana"])}`
                      : "online zakazivanje je pauzirano"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Plaćanje skeniranjem IPS QR koda iz m-banking aplikacije. Po
              evidentiranoj uplati pretplata se produžava - period uvek kreće
              od isteka postojeće, pa plaćanjem unapred ništa ne gubiš.
            </p>
          </div>
          <Button onClick={() => setPayOpen(true)}>
            <CreditCard className="size-4" />
            {sub.status === "active" || sub.status === "trial"
              ? "Produži članarinu"
              : "Plati članarinu"}
          </Button>
        </CardContent>
      </Card>

      {/* Podaci za fakturu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Podaci za fakturu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="billing-info" className="sr-only">
            Podaci za fakturu
          </Label>
          <Textarea
            id="billing-info"
            placeholder={"Naziv pravnog lica\nAdresa, grad\nPIB (opciono)"}
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            onBlur={() => {
              if (info !== billingInfo) saveInfo();
            }}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Štampaju se na fakturi kao kupac. Čuva se automatski.
          </p>
        </CardContent>
      </Card>

      {/* Istorija uplata - čista evidencija, bez akcija */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Istorija uplata</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Još nema izdatih faktura.
            </p>
          ) : (
            <div className="divide-y">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/faktura/${inv.id}`}
                    target="_blank"
                    className="min-w-14 font-bold underline-offset-2 hover:underline"
                  >
                    {invoiceLabel(inv)}
                  </Link>
                  <span className="min-w-24 text-ink/60">{fmt(inv.created_at)}</span>
                  <span className="min-w-28 font-semibold">
                    {formatAmount(Number(inv.amount))} RSD
                  </span>
                  <span className="text-ink/60">
                    {PLANS[inv.plan].label} ·{" "}
                    {new Date(`${inv.period_from}T12:00:00`).toLocaleDateString("sr-RS")} -{" "}
                    {new Date(`${inv.period_to}T12:00:00`).toLocaleDateString("sr-RS")}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      inv.status === "paid"
                        ? "bg-mint text-ink"
                        : inv.status === "cancelled"
                          ? "bg-ink/10 text-ink/50"
                          : "bg-amber-200 text-amber-950"
                    }`}
                  >
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentModal
        open={payOpen}
        onOpenChange={setPayOpen}
        defaultPlan={sub.status === "grace" || sub.status === "expired" ? "monthly" : "yearly"}
      />
    </div>
  );
}
