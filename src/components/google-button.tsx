"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// Zvanični Google "G" znak (brend smernice traže pun kolor na svetloj podlozi)
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4 shrink-0" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// Prijava/registracija Google nalogom. Ista PKCE razmena koda kao potvrda
// mejla: Google → Supabase → /auth/callback?code=... → sesija. next=/admin
// pokriva oba slučaja - postojeći vlasnik ulazi u admin, novi korisnik se
// sa /admin preusmerava na /onboarding (nema članstvo).
export function GoogleButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin`,
      },
    });
    // Uspeh = browser već odlazi na Google; ovde stižemo samo na grešku
    if (error) {
      setLoading(false);
      toast.error("Prijava preko Google naloga trenutno nije dostupna.");
    }
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2.5 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink/5 disabled:opacity-60"
    >
      <GoogleMark />
      {loading ? "Povezivanje..." : label}
    </button>
  );
}

// "ili" separator između email forme i Google dugmeta
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium text-muted-foreground">ili</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
