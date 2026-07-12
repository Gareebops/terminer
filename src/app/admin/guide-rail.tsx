"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  guideNextInfo,
  guideSteps,
  stepMatchesPath,
  type GuideData,
  type GuideNextInfo,
  type GuideStep,
  type GuideStepId,
} from "@/lib/guide";
import { GuideStepDone } from "./guide-step-done";
import { updateOnboarding } from "./actions";

// Traka vodiča: prati vlasnika po CELOM adminu dok vodič traje, pa posle
// završenog koraka ne mora nazad na Početnu - server akcije revalidiraju
// rutu, layout se ponovo izračuna i traka sama ponudi sledeći korak.
// Na Početnoj se ne prikazuje (tamo je puna kartica vodiča).
export function GuideRail({ data }: { data: GuideData }) {
  const pathname = usePathname();
  const router = useRouter();
  const [confirmPending, startConfirm] = useTransition();
  // Dijalog "Korak završen" posle potvrde iz trake; null = zatvoren
  const [stepDone, setStepDone] = useState<{
    message: string;
    next: GuideNextInfo;
  } | null>(null);

  const steps = guideSteps(data);
  const doneCount = steps.filter((s) => s.done).length;
  const step = steps.find((s) => !s.done);
  if (!step || pathname === "/admin") return null;

  const onStepPage = stepMatchesPath(step.id, pathname);

  function confirmStep(
    confirm: NonNullable<GuideStep["confirm"]>,
    confirmedId: GuideStepId
  ) {
    startConfirm(async () => {
      const res = await updateOnboarding(confirm.patch);
      if (res.ok) {
        // Upadljiva potvrda sa CTA na sledeći korak - toast koji nestane
        // je lako promašiti
        const next = guideNextInfo(data, confirmedId);
        if (next) setStepDone({ message: confirm.toast, next });
        else toast.success(confirm.toast);
        router.refresh();
      } else {
        toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      }
    });
  }

  return (
    <div
      aria-label="Vodič za pokretanje"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white px-4 py-3 shadow-card"
    >
      <span className="shrink-0 rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-ink">
        Vodič · {doneCount} od {steps.length}
      </span>
      <p className="min-w-0 flex-1 basis-52 text-sm">
        <span className="font-bold">
          {onStepPage ? step.title : `Sledeći korak: ${step.title}`}
        </span>
        {onStepPage && step.hint && (
          <span className="text-ink/70"> — {step.hint}</span>
        )}
      </p>
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
        {step.confirm && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={confirmPending}
            onClick={() => confirmStep(step.confirm!, step.id)}
          >
            <Check className="size-3.5" />
            {confirmPending ? "Čuvanje..." : step.confirm.label}
          </Button>
        )}
        {!onStepPage && step.cta && (
          <Button asChild size="sm" className="rounded-full">
            <Link href={step.cta.href}>
              {step.cta.label} <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        )}
      </div>

      {stepDone && (
        <GuideStepDone
          message={stepDone.message}
          next={stepDone.next}
          onClose={() => setStepDone(null)}
        />
      )}
    </div>
  );
}
