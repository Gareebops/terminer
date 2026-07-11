"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDots } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { updateOnboarding } from "../actions";

// Jednokratno objašnjenje modela "pravilo + izuzeci" - prikazuje se dok
// vlasnik ne klikne "Razumem" (flag raspored_seen u site_settings.onboarding)
export function RasporedIntro() {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  function dismiss() {
    setHidden(true);
    startTransition(async () => {
      await updateOnboarding({ rasporedSeen: true });
      router.refresh();
    });
  }

  if (hidden) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[2rem] bg-lavender p-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-lavender">
        <CalendarDots className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-72">
        <p className="text-sm font-bold tracking-tight">Kako radi raspored</p>
        <p className="mt-0.5 text-sm text-ink/70">
          Stalno radno vreme i smene A/B se podešavaju kod zaposlenog i važe iz
          nedelje u nedelju. Ovde menjaš pojedinačne datume: klik na dan =
          drugačije vreme ili slobodan dan, a dugme &bdquo;Odsustvo&rdquo;
          upisuje odmor u komadu.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 rounded-full border-ink/20 bg-transparent hover:bg-ink/5"
        onClick={dismiss}
      >
        Razumem
      </Button>
    </div>
  );
}
