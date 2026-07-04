"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
/* eslint-disable @next/next/no-img-element */
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatAmount, PLANS, type PlanId } from "@/lib/invoice";
import {
  preparePayment,
  updateBillingInfo,
  type PreparePaymentResult,
} from "./actions";

// Modal za plaćanje članarine: veliki IPS QR + iznos + period. Otvara se
// iz banera pri vrhu admina i sa stranice Pretplata. Faktura u pozadini je
// idempotentna, pa je svako otvaranje bezbedno - uvek ista faktura za period.
export function PaymentModal({
  open,
  onOpenChange,
  defaultPlan = "monthly",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPlan?: PlanId;
}) {
  const [plan, setPlan] = useState<PlanId>(defaultPlan);
  const [result, setResult] = useState<PreparePaymentResult | null>(null);
  const [billingInfo, setBillingInfo] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setPlan(defaultPlan);
    load(defaultPlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPlan]);

  function load(p: PlanId) {
    setResult(null);
    startTransition(async () => {
      setResult(await preparePayment(p));
    });
  }

  function switchPlan(p: PlanId) {
    if (p === plan) return;
    setPlan(p);
    load(p);
  }

  function saveBillingInfoAndRetry() {
    if (!billingInfo.trim()) {
      toast.error("Upiši naziv i adresu za fakturu.");
      return;
    }
    startTransition(async () => {
      const res = await updateBillingInfo(billingInfo);
      if (!res.ok) {
        toast.error(res.error ?? "Čuvanje nije uspelo.");
        return;
      }
      setResult(await preparePayment(plan));
    });
  }

  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("sr-RS");
  const needsBilling = result && !result.ok && result.needBillingInfo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Plaćanje članarine</DialogTitle>
          <DialogDescription>
            Skeniraj QR kod iz svoje m-banking aplikacije - svi podaci za uplatu
            se popune sami.
          </DialogDescription>
        </DialogHeader>

        {/* Izbor plana */}
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PLANS) as PlanId[]).map((p) => (
            <button
              key={p}
              type="button"
              disabled={pending}
              onClick={() => switchPlan(p)}
              data-active={plan === p}
              className="rounded-xl border p-3 text-left transition data-[active=true]:border-ring data-[active=true]:ring-1 data-[active=true]:ring-ring"
            >
              <p className="text-sm font-bold">
                {p === "monthly" ? "Mesečna" : "Godišnja"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatAmount(PLANS[p].amount)} RSD
                {p === "yearly" && " · 2 meseca gratis"}
              </p>
            </button>
          ))}
        </div>

        {needsBilling ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="pm-billing">Podaci za fakturu (kupac)</Label>
              <Textarea
                id="pm-billing"
                rows={3}
                placeholder={"Naziv pravnog lica\nAdresa, grad\nPIB (opciono)"}
                value={billingInfo}
                onChange={(e) => setBillingInfo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Upisuje se jednom - štampa se na fakturi kao kupac.
              </p>
            </div>
            <Button className="w-full" disabled={pending} onClick={saveBillingInfoAndRetry}>
              {pending ? "..." : "Sačuvaj i prikaži QR"}
            </Button>
          </div>
        ) : result?.ok ? (
          <div className="flex flex-col items-center text-center">
            <img
              src={result.qrDataUrl}
              alt="NBS IPS QR kod za plaćanje"
              width={260}
              height={260}
              className="rounded-xl border p-2"
            />
            <p className="mt-3 text-3xl font-extrabold tracking-tight">
              {formatAmount(result.amount)} <span className="text-base font-bold text-muted-foreground">RSD</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.plan === "monthly" ? "Mesečna" : "Godišnja"} članarina ·
              važi {fmt(result.periodFrom)} - {fmt(result.periodTo)}
            </p>
            <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Otvori m-banking → izaberi &bdquo;IPS skeniraj&ldquo; → skeniraj →
              potvrdi. Po evidentiranoj uplati pretplata se produžava.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Faktura {result.invoiceLabel} · poziv na broj {result.refNumber} ·{" "}
              <Link
                href={`/faktura/${result.invoiceId}`}
                target="_blank"
                className="underline"
              >
                otvori celu fakturu
              </Link>
            </p>
          </div>
        ) : result && !result.ok ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
            {result.error ?? "Nešto nije u redu. Pokušaj ponovo."}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <Skeleton className="size-64 rounded-xl" />
            <Skeleton className="h-8 w-40" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
