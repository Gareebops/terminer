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
import { TerminerMark } from "@/components/terminer-logo";
import { datumSr } from "@/lib/datum";
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

  // Reset izabranog plana pri otvaranju - obrazac "podešavanje state-a tokom
  // rendera" (React docs) umesto setState u effect-u, da se izbegne kaskadni
  // render. Effect ispod ostaje samo za učitavanje fakture/QR-a.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevDefaultPlan, setPrevDefaultPlan] = useState(defaultPlan);
  if (open !== prevOpen || defaultPlan !== prevDefaultPlan) {
    setPrevOpen(open);
    setPrevDefaultPlan(defaultPlan);
    if (open) setPlan(defaultPlan);
  }

  useEffect(() => {
    if (!open) return;
    load(defaultPlan);
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

  const fmt = (d: string) => datumSr(d);
  const needsBilling = result && !result.ok && result.needBillingInfo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2rem] font-display sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">
            Plaćanje članarine
          </DialogTitle>
          <DialogDescription>
            Skeniraj QR kod iz svoje m-banking aplikacije - svi podaci za uplatu
            se popune sami.
          </DialogDescription>
        </DialogHeader>

        {/* Izbor plana - aktivan je jedina tamna kartica (DS pravilo) */}
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PLANS) as PlanId[]).map((p) => (
            <button
              key={p}
              type="button"
              disabled={pending}
              onClick={() => switchPlan(p)}
              data-active={plan === p}
              className="rounded-2xl border-2 border-ink/10 p-3.5 text-left transition-colors data-[active=true]:border-ink data-[active=true]:bg-ink data-[active=true]:text-white"
            >
              {/* flex-wrap + nowrap: na uskom ekranu pilula pada cela u novi
                  red - bez toga se tekst prelama unutar pilule */}
              <div className="flex flex-wrap items-center justify-between gap-1">
                <p className="text-sm font-bold">
                  {p === "monthly" ? "Mesečna" : "Godišnja"}
                </p>
                {p === "yearly" && (
                  <span className="whitespace-nowrap rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-ink">
                    2 mes. gratis
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs opacity-60">
                {formatAmount(PLANS[p].amount)} RSD
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
            {/* QR na canvas podlozi, sa Terminer znakom u sredini
                (nivo korekcije H - logo ne smeta skeniranju) */}
            <div className="flex w-full flex-col items-center rounded-[1.5rem] bg-canvas p-5">
              <div className="relative rounded-2xl bg-white p-3 shadow-[0_4px_24px_rgba(20,25,20,0.08)]">
                <img
                  src={result.qrDataUrl}
                  alt="NBS IPS QR kod za plaćanje"
                  width={232}
                  height={232}
                />
                <span className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-white">
                  <TerminerMark className="size-9" />
                </span>
              </div>
              <p className="mt-4 text-3xl font-extrabold tracking-tight text-ink">
                {formatAmount(result.amount)}{" "}
                <span className="text-base font-bold text-ink/70">RSD</span>
              </p>
              <p className="mt-0.5 text-sm font-medium text-ink/70">
                {result.plan === "monthly" ? "Mesečna" : "Godišnja"} članarina
              </p>
              <span className="mt-2 rounded-full bg-mint px-3 py-1 text-xs font-bold text-ink">
                važi {fmt(result.periodFrom)} - {fmt(result.periodTo)}
              </span>
            </div>

            <ol className="mt-4 flex w-full flex-col gap-1.5 text-left text-xs font-medium text-ink/70">
              {[
                "Otvori svoju m-banking aplikaciju",
                "Izaberi „IPS skeniraj“ i skeniraj kod",
                "Potvrdi - po evidentiranoj uplati pretplata se produžava",
              ].map((step, i) => (
                <li key={step} className="flex items-center gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <p className="mt-3 text-xs text-muted-foreground">
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
