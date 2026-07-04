import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Odredište linka za potvrdu naloga (emailRedirectTo iz registracije).
// Supabase verify endpoint potvrdi email pa preusmeri ovde sa ?code=...;
// razmena koda pravi sesiju u ovom browseru. Ako razmena ne uspe (npr. link
// otvoren u drugom browseru - PKCE verifier ne postoji), nalog je svejedno
// potvrđen, pa korisnika šaljemo na prijavu sa porukom.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/prijava?potvrdjen=1", url.origin));
}
