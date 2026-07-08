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
  // Default /admin pokriva i potvrdu mejla i Google prijavu: korisnik bez
  // salona se sa /admin ionako preusmerava na /onboarding (getAdminContext).
  // Samo relativne putanje - apsolutni URL ili "//host" bi bio open redirect
  const rawNext = url.searchParams.get("next") ?? "/admin";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // Razmena nije uspela. Za potvrdu naloga / OAuth (podrazumevani next) je
  // prijava rešenje. Za ostale tokove (nova lozinka) link je neupotrebljiv
  // u ovom browseru, pa kažemo da se zatraži nov.
  const fallback = next === "/admin" ? "/prijava?potvrdjen=1" : "/prijava?greska=link";
  return NextResponse.redirect(new URL(fallback, url.origin));
}
