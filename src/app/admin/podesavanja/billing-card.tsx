"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatAmount,
  invoiceLabel,
  INVOICE_STATUS_LABELS,
  PLANS,
  type Invoice,
  type PlanId,
} from "@/lib/invoice";
import type { SubscriptionInfo } from "@/lib/billing";
import { createInvoice, updateBillingInfo } from "../actions";

const statusText: Record<string, string> = {
  trial: "Probni period",
  active: "Aktivna pretplata",
  grace: "Istekla - grace period",
  expired: "Istekla",
};

export function BillingCard({
  sub,
  paidUntil,
  billingInfo,
  invoices,
}: {
  sub: SubscriptionInfo;
  paidUntil: string | null;
  billingInfo: string;
  invoices: Invoice[];
}) {
  const router = useRouter();
  const [info, setInfo] = useState(billingInfo);
  const [confirmPlan, setConfirmPlan] = useState<PlanId | null>(null);
  const [pending, startTransition] = useTransition();

  const infoFilled = info.trim().length > 0;

  function saveInfo() {
    startTransition(async () => {
      const res = await updateBillingInfo(info);
      if (res.ok) toast.success("Podaci za fakturu su sačuvani.");
      else toast.error(res.error ?? "Greška.");
    });
  }

  // Izdavanje ide u dva koraka: izbor plana otvara dijalog sa rezimeom,
  // pa tek eksplicitna potvrda pravi fakturu (numerisana, briše se samo stornom)
  function issue() {
    const plan = confirmPlan;
    if (!plan) return;
    startTransition(async () => {
      const res = await createInvoice(plan);
      if (res.ok) {
        setConfirmPlan(null);
        router.push(`/faktura/${res.invoiceId}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card id="pretplata">
      <CardHeader>
        <CardTitle className="text-base">Pretplata i naplata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded-full px-3 py-1 font-bold ${
              sub.status === "active"
                ? "bg-mint text-ink"
                : sub.status === "trial"
                  ? "bg-lavender text-ink"
                  : "bg-red-100 text-red-900"
            }`}
          >
            {statusText[sub.status]}
          </span>
          <span className="font-medium text-ink/60">
            {sub.status === "active" && paidUntil
              ? `plaćeno do ${new Date(paidUntil).toLocaleDateString("sr-RS")}`
              : sub.status === "trial"
                ? `još ${sub.daysLeft} ${sub.daysLeft === 1 ? "dan" : "dana"} besplatno`
                : "produži pretplatu fakturom ispod"}
          </span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing-info">Podaci za fakturu</Label>
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
            Ovi podaci se štampaju na fakturi kao kupac. Čuva se automatski.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setConfirmPlan("monthly")}
          >
            <FileText className="size-4" />
            Mesečna - {formatAmount(PLANS.monthly.amount)} RSD
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setConfirmPlan("yearly")}
          >
            <FileText className="size-4" />
            Godišnja - {formatAmount(PLANS.yearly.amount)} RSD
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Izborom plana otvara se pregled fakture pre izdavanja. Faktura sadrži
          NBS IPS QR kod - plaćanje skeniranjem iz m-banking aplikacije. Po
          evidentiranoj uplati pretplata se produžava.
        </p>

        <Dialog
          open={confirmPlan !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmPlan(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Izdavanje fakture</DialogTitle>
              <DialogDescription>
                Faktura dobija redni broj i ne može se obrisati (samo stornirati).
                Proveri podatke pre izdavanja.
              </DialogDescription>
            </DialogHeader>
            {confirmPlan && (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="font-medium">{PLANS[confirmPlan].label}</span>
                  <span className="font-bold">
                    {formatAmount(PLANS[confirmPlan].amount)} RSD
                  </span>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Kupac</p>
                  {infoFilled ? (
                    <p className="mt-1 whitespace-pre-line">{info.trim()}</p>
                  ) : (
                    <p className="mt-1 text-amber-700">
                      Podaci za fakturu nisu upisani - zatvori ovaj prozor i
                      popuni polje &bdquo;Podaci za fakturu&ldquo;.
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Period važenja kreće od danas, ili od isteka postojeće
                  pretplate ako je još aktivna.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmPlan(null)}>
                Odustani
              </Button>
              <Button disabled={pending || !infoFilled} onClick={issue}>
                <FileText className="size-4" />
                {pending ? "Izdavanje…" : "Izdaj fakturu"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {invoices.length > 0 && (
          <div>
            <p className="text-sm font-semibold">Izdate fakture</p>
            <ul className="mt-2 space-y-1.5">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <a href={`/faktura/${inv.id}`} className="font-bold underline">
                    {invoiceLabel(inv)}
                  </a>
                  <span className="text-ink/60">
                    {PLANS[inv.plan].label} · {formatAmount(Number(inv.amount))} RSD ·{" "}
                    {new Date(inv.created_at).toLocaleDateString("sr-RS")}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      inv.status === "paid"
                        ? "bg-mint text-ink"
                        : inv.status === "cancelled"
                          ? "bg-ink/10 text-ink/50"
                          : "bg-amber-200 text-amber-950"
                    }`}
                  >
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
