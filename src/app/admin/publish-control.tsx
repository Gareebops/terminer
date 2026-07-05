"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Globe, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setPublished } from "./actions";

// Objava sajta je NAJVAŽNIJA akcija vlasnika - zato živi u layoutu (vidljiva
// na svakoj admin stranici), a ne kao switch zakopan u podešavanjima.
// Neobjavljen sajt: upadljivo mint dugme "Objavi sajt". Objavljen: diskretan
// status "Sajt je uživo". Oba otvaraju isti zvaničan dijalog.
export function PublishControl({
  slug,
  isPublished,
  suspended,
  variant,
}: {
  slug: string;
  isPublished: boolean;
  suspended: boolean;
  variant: "sidebar" | "mobile";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [published, setPublishedState] = useState(isPublished);
  // Trenutak "upravo objavljeno" - dijalog prikazuje proslavu sa linkom
  const [justPublished, setJustPublished] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [host, setHost] = useState("terminer.rs");
  const [pending, startTransition] = useTransition();

  useEffect(() => setPublishedState(isPublished), [isPublished]);
  useEffect(() => setHost(window.location.host), []);

  const siteUrl = `${typeof window !== "undefined" ? window.location.origin : "https://terminer.rs"}/${slug}`;
  const siteLabel = `${host}/${slug}`;

  function publish() {
    startTransition(async () => {
      const res = await setPublished(true);
      if (!res.ok) {
        toast.error(res.error ?? "Objava nije uspela.");
        return;
      }
      setPublishedState(true);
      setJustPublished(true);
      router.refresh();
    });
  }

  function unpublish() {
    startTransition(async () => {
      const res = await setPublished(false);
      if (!res.ok) {
        toast.error(res.error ?? "Nije uspelo.");
        return;
      }
      setPublishedState(false);
      setConfirmUnpublish(false);
      setJustPublished(false);
      toast.success("Sajt je skinut sa mreže.");
      router.refresh();
    });
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

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setConfirmUnpublish(false);
      setJustPublished(false);
    }
  }

  if (suspended) return null; // layout već prikazuje crveni baner

  const trigger =
    variant === "sidebar" ? (
      published ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-mint" />
          </span>
          Sajt je uživo
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-mint px-4 py-2.5 text-sm font-bold text-ink transition-opacity hover:opacity-90"
        >
          <Rocket className="size-4" /> Objavi sajt
        </button>
      )
    ) : published ? (
      <button
        onClick={() => setOpen(true)}
        aria-label="Status sajta"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/20"
      >
        <span className="size-1.5 rounded-full bg-mint" /> Uživo
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full bg-mint px-3.5 py-1.5 text-xs font-bold text-ink transition-opacity hover:opacity-90"
      >
        Objavi sajt
      </button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-[2rem] font-display sm:max-w-md">
          {published ? (
            <>
              <DialogHeader>
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint text-ink">
                  {justPublished ? <Rocket className="size-7" /> : <Globe className="size-7" />}
                </span>
                <DialogTitle className="text-center text-xl font-extrabold tracking-tight">
                  {justPublished ? "Sajt je objavljen!" : "Tvoj sajt je uživo"}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {justPublished
                    ? "Čestitamo - salon je na internetu. Podeli link sa klijentima:"
                    : "Posetioci mogu da ga vide i zakažu termin online."}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 rounded-full bg-canvas py-2 pl-5 pr-2">
                <p className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight">
                  {siteLabel}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={copyLink}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Kopirano" : "Kopiraj"}
                </Button>
              </div>

              <div className="flex justify-center">
                <Button asChild className="rounded-full">
                  <a href={siteUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Otvori sajt
                  </a>
                </Button>
              </div>

              <div className="mt-2 border-t pt-3 text-center">
                {confirmUnpublish ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-900">
                      Sajt više neće biti vidljiv i klijenti neće moći da
                      zakazuju online. Sigurno?
                    </p>
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmUnpublish(false)}
                      >
                        Odustani
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-full"
                        disabled={pending}
                        onClick={unpublish}
                      >
                        {pending ? "Skidanje..." : "Da, skini sajt"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmUnpublish(true)}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Skini sajt sa mreže
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
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
                Pre objave proveri usluge, radno vreme zaposlenih i kontakt
                podatke. Sajt možeš u svakom trenutku da skineš sa mreže.
              </p>

              <Button
                size="lg"
                className="w-full rounded-full bg-mint font-bold text-ink hover:bg-mint/85"
                disabled={pending}
                onClick={publish}
              >
                {pending ? "Objavljivanje..." : "Objavi sajt"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
