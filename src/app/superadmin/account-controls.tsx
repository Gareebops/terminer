"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeOwnerEmail,
  deleteTenant,
  exportTenantData,
  impersonateOwner,
  resendOwnerConfirmation,
  sendOwnerPasswordReset,
  suspendTenant,
  transferOwnership,
  unsuspendTenant,
} from "./account-actions";

type DialogKind = "suspend" | "delete" | "email" | "transfer" | "impersonate" | null;

export function AccountControls({
  tenantId,
  slug,
  suspended,
  ownerConfirmed,
}: {
  tenantId: string;
  slug: string;
  suspended: boolean;
  ownerConfirmed: boolean;
}) {
  const [open, setOpen] = useState<DialogKind>(null);
  const [field, setField] = useState("");
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        setOpen(null);
        setField("");
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  function download() {
    startTransition(async () => {
      const res = await exportTenantData(tenantId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Izvoz preuzet.");
    });
  }

  function impersonate() {
    startTransition(async () => {
      // Uspeh = redirect na /admin, pa se rezultat i ne vraća
      const res = await impersonateOwner(tenantId);
      if (res && !res.ok) toast.error(res.error ?? "Greška.");
    });
  }

  const pill =
    "rounded-full px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-40";

  const dialogs: Record<
    Exclude<DialogKind, null>,
    { title: string; desc: string; body?: React.ReactNode; confirm: () => void; confirmLabel: string; destructive?: boolean }
  > = {
    suspend: {
      title: "Suspenzija salona",
      desc: "Sajt se odmah skida sa javnog interneta i ne može se objaviti dok suspenzija traje. Vlasnik vidi baner sa razlogom u svom adminu.",
      body: (
        <div className="space-y-2">
          <Label htmlFor="sa-reason">Razlog (vidljiv vlasniku)</Label>
          <Input
            id="sa-reason"
            value={field}
            onChange={(e) => setField(e.target.value)}
            placeholder="npr. Neprikladan sadržaj na sajtu"
          />
        </div>
      ),
      confirm: () =>
        run(() => suspendTenant({ tenantId, reason: field }), "Salon je suspendovan."),
      confirmLabel: "Suspenduj",
      destructive: true,
    },
    delete: {
      title: "Trajno brisanje salona",
      desc: "Briše se SVE: sajt, usluge, rezervacije, klijenti, fakture, slike i nalog vlasnika. Nema povratka. Prvo preuzmi izvoz podataka!",
      body: (
        <div className="space-y-2">
          <Label htmlFor="sa-slug">Upiši slug salona ({slug}) za potvrdu</Label>
          <Input
            id="sa-slug"
            value={field}
            onChange={(e) => setField(e.target.value)}
            placeholder={slug}
          />
        </div>
      ),
      confirm: () =>
        run(() => deleteTenant({ tenantId, confirmSlug: field }), "Salon je obrisan."),
      confirmLabel: "Obriši zauvek",
      destructive: true,
    },
    email: {
      title: "Promena email adrese vlasnika",
      desc: "Koristi se kad vlasnik izgubi pristup mejlu. Prvo proveri identitet (telefonom!). Nova adresa se odmah smatra potvrđenom.",
      body: (
        <div className="space-y-2">
          <Label htmlFor="sa-email">Nova email adresa</Label>
          <Input
            id="sa-email"
            type="email"
            value={field}
            onChange={(e) => setField(e.target.value)}
          />
        </div>
      ),
      confirm: () =>
        run(() => changeOwnerEmail({ tenantId, newEmail: field }), "Email je promenjen."),
      confirmLabel: "Promeni email",
    },
    transfer: {
      title: "Prenos vlasništva salona",
      desc: "Novi vlasnik mora već imati registrovan i potvrđen Terminer nalog (i ne sme već voditi drugi salon).",
      body: (
        <div className="space-y-2">
          <Label htmlFor="sa-transfer">Email novog vlasnika</Label>
          <Input
            id="sa-transfer"
            type="email"
            value={field}
            onChange={(e) => setField(e.target.value)}
          />
        </div>
      ),
      confirm: () =>
        run(
          () => transferOwnership({ tenantId, newOwnerEmail: field }),
          "Vlasništvo je preneto."
        ),
      confirmLabel: "Prenesi",
    },
    impersonate: {
      title: "Ulaz kao vlasnik",
      desc: "Tvoja superadmin sesija se ZAMENJUJE sesijom vlasnika - videćeš tačno ono što on vidi. Koristi samo uz njegovu saglasnost; akcija se trajno beleži. Povratak: odjava pa ponovna prijava.",
      confirm: impersonate,
      confirmLabel: "Uđi kao vlasnik",
      destructive: true,
    },
  };

  const d = open ? dialogs[open] : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        disabled={pending}
        onClick={() =>
          run(() => sendOwnerPasswordReset(tenantId), "Reset lozinke je poslat vlasniku.")
        }
        className={`${pill} bg-ink/10 text-ink`}
        title="Šalje standardni mejl za promenu lozinke"
      >
        Reset lozinke
      </button>
      {!ownerConfirmed && (
        <button
          disabled={pending}
          onClick={() =>
            run(() => resendOwnerConfirmation(tenantId), "Potvrda naloga je poslata.")
          }
          className={`${pill} bg-amber-200 text-amber-950`}
        >
          Pošalji potvrdu
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => setOpen("email")}
        className={`${pill} bg-ink/10 text-ink`}
      >
        Promeni email
      </button>
      <button
        disabled={pending}
        onClick={() => setOpen("transfer")}
        className={`${pill} bg-ink/10 text-ink`}
      >
        Prenesi vlasništvo
      </button>
      <button disabled={pending} onClick={download} className={`${pill} bg-ink/10 text-ink`}>
        Izvoz podataka
      </button>
      <button
        disabled={pending}
        onClick={() => setOpen("impersonate")}
        className={`${pill} bg-lavender text-ink`}
      >
        Uđi kao vlasnik
      </button>
      {suspended ? (
        <button
          disabled={pending}
          onClick={() => run(() => unsuspendTenant(tenantId), "Suspenzija je ukinuta.")}
          className={`${pill} bg-mint text-ink`}
        >
          Ukini suspenziju
        </button>
      ) : (
        <button
          disabled={pending}
          onClick={() => setOpen("suspend")}
          className={`${pill} bg-red-100 text-red-900`}
        >
          Suspenduj
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => setOpen("delete")}
        className={`${pill} bg-red-600 text-white`}
      >
        Obriši
      </button>

      <Dialog
        open={open !== null}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(null);
            setField("");
          }
        }}
      >
        <DialogContent>
          {d && (
            <>
              <DialogHeader>
                <DialogTitle>{d.title}</DialogTitle>
                <DialogDescription>{d.desc}</DialogDescription>
              </DialogHeader>
              {d.body}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(null)}>
                  Odustani
                </Button>
                <Button
                  variant={d.destructive ? "destructive" : "default"}
                  disabled={pending}
                  onClick={d.confirm}
                >
                  {pending ? "..." : d.confirmLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
