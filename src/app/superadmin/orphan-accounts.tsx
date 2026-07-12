"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteAccountWithoutSalon } from "./account-actions";

// Nalozi koji su se registrovali a nikad završili onboarding - do sada su
// bili potpuno nevidljivi (panel kreće od tenant_members). GDPR brisanje +
// uvid u to gde se funnel registracije gubi.
export interface OrphanAccount {
  id: string;
  email: string | null;
  createdLabel: string;
  lastSignInLabel: string | null;
  confirmed: boolean;
  // Superadmin nalozi su po dizajnu bez salona pa upadaju u ovu listu -
  // označeni su i bez dugmeta za brisanje (server ih svakako odbija)
  superadmin: boolean;
}

export function OrphanAccounts({ accounts }: { accounts: OrphanAccount[] }) {
  const [pending, startTransition] = useTransition();

  if (accounts.length === 0) return null;

  function remove(acc: OrphanAccount) {
    if (!confirm(`Trajno obrisati nalog ${acc.email ?? acc.id}? Nema povratka.`)) return;
    startTransition(async () => {
      const res = await deleteAccountWithoutSalon(acc.id);
      if (res.ok) toast.success("Nalog je obrisan.");
      else toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
    });
  }

  return (
    <div>
      <h2 className="mt-10 text-xl font-extrabold tracking-tight">
        Nalozi bez salona ({accounts.length})
      </h2>
      <p className="mt-1 text-sm font-medium text-ink/70">
        Registrovani, ali nikad nisu napravili salon - kandidati za javljanje
        ili čišćenje (GDPR).
      </p>
      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-card">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/5 px-4 py-2.5 text-sm last:border-0"
          >
            <span className="min-w-44 font-semibold">
              {acc.email ? (
                <a href={`mailto:${acc.email}`} className="hover:underline">
                  {acc.email}
                </a>
              ) : (
                "bez mejla"
              )}
            </span>
            <span className="text-xs text-ink/70">
              registrovan {acc.createdLabel} · prijavljen{" "}
              {acc.lastSignInLabel ?? "nikad"}
              {!acc.confirmed && " · nepotvrđen"}
            </span>
            {acc.superadmin ? (
              <span className="ml-auto rounded-full bg-lavender/40 px-3 py-1.5 text-xs font-bold text-ink/70">
                superadmin
              </span>
            ) : (
              <button
                disabled={pending}
                onClick={() => remove(acc)}
                className="ml-auto rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink/70 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
              >
                Obriši nalog
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
