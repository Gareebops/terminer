"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, ExternalLink, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfettiBurst } from "@/components/confetti";
import { HeroDemo } from "@/components/landing/hero-demo";
import { setPublished, updateOnboarding } from "./actions";

// Vodič za pokretanje: koraci se štikliraju sami iz stvarnih podataka
// (bez "tutorial state" mašinerije), pa vodič prepoznaje i ono što je
// vlasnik uradio bez njega. Kartica nestaje objavom sajta, ali komponenta
// ostaje montirana (published prop) da bi proslava objave preživela
// osvežavanje Početne koje server akcija povuče.

function plural(n: number, forms: [string, string, string]): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return forms[0];
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return forms[1];
  return forms[2];
}

export function OnboardingGuide({
  slug,
  salonName,
  published,
  showWelcome,
  servicesCount,
  staffCount,
  appearanceTouched,
}: {
  slug: string;
  salonName: string;
  published: boolean;
  showWelcome: boolean;
  servicesCount: number;
  staffCount: number;
  appearanceTouched: boolean;
}) {
  const router = useRouter();
  const [welcomeOpen, setWelcomeOpen] = useState(showWelcome);
  const [hidden, setHidden] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();
  const [publishPending, startPublish] = useTransition();

  // Renderuje se samo posle interakcije (nikad tokom SSR), pa je window tu
  const siteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${slug}`
      : `https://terminer.rs/${slug}`;
  const siteLabel = siteUrl.replace(/^https?:\/\//, "");
  const shareText = encodeURIComponent(
    `Naš salon je sada online - pogledaj i zakaži termin: ${siteUrl}`
  );

  const steps = [
    {
      title: "Napravi nalog i nazovi salon",
      done: true,
      meta: undefined as string | undefined,
      desc: "",
      cta: null as { href: string; label: string } | null,
    },
    {
      title: "Dodaj usluge i cene",
      done: servicesCount > 0,
      meta:
        servicesCount > 0
          ? `${servicesCount} ${plural(servicesCount, ["usluga", "usluge", "usluga"])}`
          : undefined,
      desc: "Šišanje, farbanje, brada... Trajanje određuje koliko termin zauzima u kalendaru.",
      cta: { href: "/admin/usluge", label: "Dodaj usluge" },
    },
    {
      title: "Dodaj tim i radno vreme",
      done: staffCount > 0,
      meta:
        staffCount > 0
          ? `${staffCount} ${plural(staffCount, ["član", "člana", "članova"])}`
          : undefined,
      desc: "I ako radiš sam - ti si tim. Od radnog vremena se prave slobodni termini.",
      cta: { href: "/admin/zaposleni", label: "Dodaj tim" },
    },
    {
      title: "Doteraj izgled sajta",
      done: appearanceTouched,
      meta: undefined,
      desc: "Boja brenda, slike i kontakt podaci - da sajt liči baš na tvoj salon.",
      cta: { href: "/admin/podesavanja", label: "Otvori izgled" },
    },
    {
      title: "Pogledaj sajt i objavi ga",
      done: false,
      meta: undefined,
      desc: "Proveri kako izgleda klijentima, pa ga pusti na mrežu jednim klikom.",
      cta: null,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((s) => !s.done);

  function closeWelcome() {
    setWelcomeOpen(false);
    startTransition(async () => {
      await updateOnboarding({ welcomeSeen: true });
    });
  }

  function hideGuide() {
    setHidden(true);
    startTransition(async () => {
      const res = await updateOnboarding({ guideHidden: true });
      if (res.ok) {
        toast.success("Vodič je sakriven. Sve stranice su ti u meniju.");
        router.refresh();
      }
    });
  }

  function publishNow() {
    startPublish(async () => {
      const res = await setPublished(true);
      if (!res.ok) {
        toast.error(res.error ?? "Objava nije uspela.");
        return;
      }
      setPublishOpen(false);
      setCelebrating(true);
    });
  }

  function closeCelebration() {
    setCelebrating(false);
    router.refresh();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopiranje nije uspelo.");
    }
  }

  if (hidden) return null;

  return (
    <>
      {!published && (
      <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-[0_4px_24px_rgba(20,25,20,0.06)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold tracking-tight">Pokreni svoj sajt</h2>
          <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-ink">
            {doneCount} od {steps.length}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-ink/50">
          {steps.length - doneCount === 1
            ? "Još samo objava i salon je na mreži."
            : `Još ${steps.length - doneCount} ${plural(steps.length - doneCount, ["korak", "koraka", "koraka"])} i salon je na mreži - treba oko 10 minuta.`}
        </p>
        <div className="mt-4 h-2.5 rounded-full bg-ink/5">
          <div
            className="h-2.5 rounded-full bg-mint-strong transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>

        <div className="mt-2 divide-y divide-ink/5">
          {steps.map((step, i) => {
            const isCurrent = i === currentIndex;
            return (
              <div key={step.title} className="flex flex-wrap items-center gap-3 py-3">
                {step.done ? (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint text-ink">
                    <Check className="size-3.5" />
                  </span>
                ) : (
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isCurrent
                        ? "border-2 border-ink text-ink"
                        : "border border-ink/20 text-ink/40"
                    }`}
                  >
                    {i + 1}
                  </span>
                )}

                <div className="min-w-0 flex-1 basis-48">
                  <p
                    className={`text-sm ${
                      step.done
                        ? "font-medium text-ink/40 line-through"
                        : isCurrent
                          ? "font-bold"
                          : "font-medium text-ink/50"
                    }`}
                  >
                    {step.title}
                  </p>
                  {isCurrent && step.desc && (
                    <p className="mt-0.5 text-xs text-ink/50">{step.desc}</p>
                  )}
                </div>

                {step.done && step.meta && (
                  <span className="shrink-0 text-xs font-medium text-ink/40">
                    {step.meta}
                  </span>
                )}
                {isCurrent && step.cta && (
                  <Button asChild size="sm" className="ml-auto shrink-0 rounded-full">
                    <Link href={step.cta.href}>
                      {step.cta.label} <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                )}
                {isCurrent && i === steps.length - 1 && (
                  <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <a href={`/${slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" /> Pogledaj sajt
                      </a>
                    </Button>
                    <button
                      onClick={() => setPublishOpen(true)}
                      className="flex items-center gap-2 rounded-full bg-mint px-4 py-2 text-sm font-bold text-ink transition-opacity hover:opacity-90"
                    >
                      <Rocket className="size-4" /> Objavi sajt
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            onClick={hideGuide}
            className="text-xs text-ink/40 underline-offset-2 hover:underline"
          >
            Sakrij vodič
          </button>
        </div>
      </div>
      )}

      {/* Potvrda objave - isti sadržaj kao zvaničan dijalog objave */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="rounded-[2rem] font-display sm:max-w-md">
          <DialogHeader>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-ink text-mint">
              <Rocket className="size-7" />
            </span>
            <DialogTitle className="text-center text-xl font-extrabold tracking-tight">
              Objavi svoj sajt
            </DialogTitle>
            <DialogDescription className="text-center">
              Sajt i online zakazivanje postaju dostupni svima na adresi:
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-full bg-canvas px-5 py-2.5 text-center text-sm font-bold tracking-tight">
            {siteLabel}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Sajt možeš u svakom trenutku da skloniš sa mreže.
          </p>
          <Button
            size="lg"
            className="w-full rounded-full bg-mint font-bold text-ink hover:bg-mint/85"
            disabled={publishPending}
            onClick={publishNow}
          >
            {publishPending ? "Objavljivanje..." : "Objavi sajt"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Proslava: konfete + deljenje - živi van kartice da preživi refresh */}
      {celebrating && <ConfettiBurst />}
      <Dialog open={celebrating} onOpenChange={(o) => !o && closeCelebration()}>
        <DialogContent className="rounded-[2rem] font-display sm:max-w-md">
          <DialogHeader>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint text-ink">
              <Rocket className="size-7" />
            </span>
            <DialogTitle className="text-center text-xl font-extrabold tracking-tight">
              Sajt je objavljen!
            </DialogTitle>
            <DialogDescription className="text-center">
              Čestitamo - {salonName} je na internetu. Podeli link sa
              klijentima:
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-full bg-canvas py-2 pl-5 pr-2">
            <p className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight">
              {siteLabel}
            </p>
            <Button size="sm" variant="outline" className="rounded-full" onClick={copyLink}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Kopirano" : "Kopiraj"}
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={`viber://forward?text=${shareText}`}
              className="flex items-center gap-1.5 rounded-full bg-[#7360F2] px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Podeli na Viber
            </a>
            <a
              href={`https://wa.me/?text=${shareText}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Podeli na WhatsApp
            </a>
          </div>
          <div className="flex justify-center">
            <Button asChild variant="outline" className="rounded-full">
              <a href={siteUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Otvori sajt
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={welcomeOpen} onOpenChange={(o) => !o && closeWelcome()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] font-display sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-extrabold tracking-tight">
              Dobro došao u Terminer
            </DialogTitle>
            <DialogDescription className="text-center">
              Ovako će klijenti zakazivati kod tebe - sami, sa telefona, i u 3
              ujutru:
            </DialogDescription>
          </DialogHeader>

          <div className="flex h-[292px] justify-center overflow-hidden">
            <div className="origin-top scale-[0.68]">
              <HeroDemo compact />
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Da bi <span className="font-bold text-ink">{salonName}</span> ovako
            radio, dodaj još usluge, tim i izgled. Vodič na Početnoj te vodi
            korak po korak - za desetak minuta si online.
          </p>

          <Button
            size="lg"
            className="w-full rounded-full bg-mint font-bold text-ink hover:bg-mint/85"
            onClick={closeWelcome}
          >
            Krenimo <ArrowRight className="size-4" />
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
