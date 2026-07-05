"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Globe, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkDomainStatus,
  removeCustomDomain,
  setCustomDomain,
  type DomainStatus,
} from "../domain-actions";

const STATE_BADGE: Record<DomainStatus["state"], { label: string; cls: string }> = {
  active: { label: "Aktivan", cls: "bg-mint text-ink" },
  pending_dns: { label: "Čeka DNS podešavanje", cls: "bg-amber-200 text-amber-950" },
  needs_txt: { label: "Potrebna verifikacija", cls: "bg-amber-200 text-amber-950" },
  unknown: { label: "Status nepoznat", cls: "bg-ink/10 text-ink/60" },
};

// Kartica "Domen" u Podešavanjima: povezivanje sopstvenog domena salona.
// Adresa terminer.rs/{slug} uvek radi - custom domen je dodatak.
export function DomainCard({
  slug,
  customDomain,
}: {
  slug: string;
  customDomain: string | null;
}) {
  const [domain, setDomain] = useState(customDomain ?? "");
  const [connected, setConnected] = useState(customDomain);
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // Povezan domen: proveri status odmah (DNS propagacija ume da potraje,
  // pa vlasnik ima i ručno "Proveri ponovo")
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    checkDomainStatus().then((res) => {
      if (!cancelled && res.ok) setStatus(res.status);
    });
    return () => {
      cancelled = true;
    };
  }, [connected]);

  function connect() {
    startTransition(async () => {
      const res = await setCustomDomain(domain);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConnected(res.status.domain);
      setDomain(res.status.domain);
      setStatus(res.status);
      toast.success("Domen je povezan - podesi DNS kod registrara.");
    });
  }

  function recheck() {
    startTransition(async () => {
      const res = await checkDomainStatus();
      if (res.ok) {
        setStatus(res.status);
        if (res.status.state === "active") toast.success("Domen je aktivan!");
      } else toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeCustomDomain();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConnected(null);
      setStatus(null);
      setDomain("");
      setConfirmRemove(false);
      toast.success("Domen je uklonjen.");
    });
  }

  async function copy(value: string, idx: number) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      toast.error("Kopiranje nije uspelo.");
    }
  }

  const badge = status ? STATE_BADGE[status.state] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="size-4" /> Domen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Tvoj sajt je uvek dostupan na{" "}
          <span className="font-semibold text-foreground">terminer.rs/{slug}</span>.
          {!connected && " Ako imaš svoj domen (npr. mojsalon.rs), poveži ga ovde."}
        </p>

        {connected ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-canvas px-4 py-1.5 text-sm font-bold tracking-tight">
                {connected}
              </span>
              {badge && (
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.cls}`}>
                  {badge.label}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={recheck}
                title="Proveri status domena"
              >
                <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} />
                Proveri
              </Button>
            </div>

            {status && status.state !== "active" && (
              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-sm font-medium">
                  {status.state === "needs_txt"
                    ? "Dodaj ovaj TXT zapis kod registrara da potvrdiš vlasništvo:"
                    : "Kod svog registrara (gde si kupio domen) dodaj ovaj DNS zapis:"}
                </p>
                <div className="space-y-1.5">
                  {status.records.map((r, i) => (
                    <div
                      key={`${r.type}-${r.value}`}
                      className="flex flex-wrap items-center gap-2 text-xs"
                    >
                      <span className="w-14 rounded-full bg-ink/5 px-2 py-1 text-center font-bold">
                        {r.type}
                      </span>
                      <span className="font-mono">{r.name}</span>
                      <span aria-hidden>→</span>
                      <span className="min-w-0 truncate font-mono">{r.value}</span>
                      <button
                        onClick={() => copy(r.value, i)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Kopiraj vrednost"
                      >
                        {copiedIdx === i ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Promena se primeni za nekoliko minuta do nekoliko sati - klikni
                  „Proveri" kad podesiš.
                </p>
              </div>
            )}

            <div className="border-t pt-3">
              {confirmRemove ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-red-900">
                    Sajt više neće raditi na {connected}. Sigurno?
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                    Odustani
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-full"
                    disabled={pending}
                    onClick={remove}
                  >
                    {pending ? "Uklanjanje..." : "Da, ukloni"}
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(true)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Ukloni domen
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="custom-domain">Tvoj domen</Label>
              <Input
                id="custom-domain"
                placeholder="mojsalon.rs"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>
            <Button disabled={pending || domain.trim().length < 4} onClick={connect}>
              {pending ? "Povezivanje..." : "Poveži domen"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
