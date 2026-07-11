"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  Check,
  Copy,
  Globe,
  RocketLaunch,
} from "@/components/icons";
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
import { setPublished } from "./actions";

// Host se ne menja tokom života stranice - useSyncExternalStore nam treba
// samo zbog server/klijent snapshot-a, pa je subscribe prazan (i stabilan).
const emptySubscribe = () => () => {};

// Objava sajta je NAJVAŽNIJA akcija vlasnika - zato živi u layoutu (vidljiva
// na svakoj admin stranici), a ne kao switch zakopan u podešavanjima.
// Neobjavljen sajt: upadljivo mint dugme "Objavi sajt". Objavljen: diskretan
// status "Sajt je online". Oba otvaraju isti zvaničan dijalog.
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
  // Objava bi iznela prazan sajt - server vratio šta nedostaje
  const [emptyWarning, setEmptyWarning] = useState<{
    services: number;
    staff: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  // Pravi host je poznat tek u browseru - na serveru (i tokom hidracije)
  // fallback, posle React sam ubaci window vrednost. Bez setState u efektu.
  const host = useSyncExternalStore(
    emptySubscribe,
    () => window.location.host,
    () => "terminer.rs"
  );
  const [pending, startTransition] = useTransition();

  // router.refresh (posle objave/sklanjanja) donosi svež isPublished sa
  // servera - uskladi lokalno stanje tokom rendera (React obrazac za promenu
  // propa), a ne u efektu. justPublished ostaje netaknut, pa proslava
  // objave preživljava refresh.
  const [prevIsPublished, setPrevIsPublished] = useState(isPublished);
  if (prevIsPublished !== isPublished) {
    setPrevIsPublished(isPublished);
    setPublishedState(isPublished);
  }

  const siteUrl = `${typeof window !== "undefined" ? window.location.origin : "https://terminer.rs"}/${slug}`;
  const siteLabel = `${host}/${slug}`;
  const shareText = encodeURIComponent(
    `Naš salon je sada online - pogledaj i zakaži termin: ${siteUrl}`
  );

  function publish(force = false) {
    startTransition(async () => {
      const res = await setPublished(true, force);
      if (!res.ok) {
        if ("emptySite" in res && res.emptySite) {
          setEmptyWarning(res.emptySite);
          return;
        }
        toast.error(res.error ?? "Objava nije uspela.");
        return;
      }
      setEmptyWarning(null);
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
      toast.success("Sajt je sklonjen sa mreže.");
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
      setEmptyWarning(null);
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
          Sajt je online
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-mint px-4 py-2.5 text-sm font-bold text-ink transition-opacity hover:opacity-90"
        >
          <RocketLaunch className="size-4" /> Objavi sajt
        </button>
      )
    ) : published ? (
      <button
        onClick={() => setOpen(true)}
        aria-label="Status sajta"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2.5 text-xs font-semibold transition-colors hover:bg-white/20"
      >
        <span className="size-1.5 rounded-full bg-mint" /> Online
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full bg-mint px-4 py-2.5 text-xs font-bold text-ink transition-opacity hover:opacity-90"
      >
        Objavi sajt
      </button>
    );

  return (
    <>
      {trigger}
      {justPublished && open && <ConfettiBurst />}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-[2rem] font-display sm:max-w-md">
          {published ? (
            <>
              <DialogHeader>
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint text-ink">
                  {justPublished ? <RocketLaunch className="size-7" /> : <Globe className="size-7" />}
                </span>
                <DialogTitle className="text-center text-xl font-extrabold tracking-tight">
                  {justPublished ? "Sajt je objavljen!" : "Tvoj sajt je online"}
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
                    <ArrowSquareOut className="size-4" /> Otvori sajt
                  </a>
                </Button>
              </div>

              {justPublished && (
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
              )}

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
                        {pending ? "Sklanjanje..." : "Da, skloni sajt"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmUnpublish(true)}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Skloni sajt sa mreže
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-ink text-mint">
                  <RocketLaunch className="size-7" />
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
                podatke. Sajt možeš u svakom trenutku da skloniš sa mreže.
              </p>

              {emptyWarning ? (
                <div className="space-y-3 rounded-2xl bg-amber-100 p-4">
                  <p className="text-center text-sm font-medium text-amber-950">
                    {emptyWarning.services === 0 && emptyWarning.staff === 0
                      ? "Sajt još nema nijednu uslugu ni člana tima - klijenti neće imati šta da zakažu."
                      : emptyWarning.services === 0
                        ? "Sajt još nema nijednu aktivnu uslugu - klijenti neće imati šta da zakažu."
                        : "Sajt još nema nijednog aktivnog člana tima - klijenti neće imati kod koga da zakažu."}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild size="sm" className="rounded-full">
                      <a
                        href={
                          emptyWarning.services === 0
                            ? "/admin/usluge"
                            : "/admin/zaposleni"
                        }
                      >
                        {emptyWarning.services === 0 ? "Dodaj usluge" : "Dodaj tim"}
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={pending}
                      onClick={() => publish(true)}
                    >
                      {pending ? "Objavljivanje..." : "Objavi svejedno"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="lg"
                  variant="brand-mint"
                  className="h-11 w-full"
                  disabled={pending}
                  onClick={() => publish()}
                >
                  {pending ? "Objavljivanje..." : "Objavi sajt"}
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
