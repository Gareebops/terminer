"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GuideNextInfo } from "@/lib/guide";

// Upadljiva potvrda završenog koraka vodiča sa velikim CTA na sledeći.
// Toast koji nestane je lako promašiti, a ovo je tačka gde novi vlasnik
// odlučuje da li razume aplikaciju - zato dijalog, ne toast.
export function GuideStepDone({
  message,
  next,
  onClose,
}: {
  // null = zatvoren; string = poruka upravo završenog koraka
  message: string | null;
  next: GuideNextInfo;
  onClose: () => void;
}) {
  return (
    <Dialog open={message !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-[2rem] font-display sm:max-w-md">
        <DialogHeader>
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint text-ink">
            <Check className="size-7" />
          </span>
          <DialogTitle className="text-center text-xl font-extrabold tracking-tight">
            Korak završen!
          </DialogTitle>
          <DialogDescription className="text-center">{message}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <div
            className="h-2.5 rounded-full bg-ink/5"
            role="progressbar"
            aria-label="Napredak vodiča"
            aria-valuemin={0}
            aria-valuemax={next.total}
            aria-valuenow={next.doneAfter}
            aria-valuetext={`${next.doneAfter} od ${next.total} koraka`}
          >
            <div
              className="h-2.5 rounded-full bg-mint-strong transition-all"
              style={{ width: `${(next.doneAfter / next.total) * 100}%` }}
            />
          </div>
          <p className="text-center text-xs font-semibold text-ink/70">
            {next.doneAfter} od {next.total} koraka - sledeće: {next.title.toLowerCase()}
          </p>
        </div>
        <Button
          asChild
          size="lg"
          variant="brand-mint"
          className="h-11 w-full"
          onClick={onClose}
        >
          <Link href={next.href}>
            {next.label} <ArrowRight className="size-4" />
          </Link>
        </Button>
        <button
          onClick={onClose}
          className="mx-auto text-xs text-ink/70 underline-offset-2 hover:underline"
        >
          Ostani na ovoj stranici
        </button>
      </DialogContent>
    </Dialog>
  );
}
