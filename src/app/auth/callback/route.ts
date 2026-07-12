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

  // Supabase na istekao/nevažeći link i otkazan OAuth consent dolazi BEZ
  // code, sa ?error=...&error_code=... - to NIJE uspešna potvrda pa ne sme
  // na zelenu "Nalog je potvrđen" poruku: istekao link → amber uputstvo da
  // se zatraži nov; otkazana Google prijava → čista prijava bez banera.
  if (!code && (url.searchParams.get("error") || url.searchParams.get("error_code"))) {
    const cancelled = url.searchParams.get("error") === "access_denied" &&
      url.searchParams.get("error_code") !== "otp_expired";
    return NextResponse.redirect(
      new URL(cancelled ? "/prijava" : "/prijava?greska=link", url.origin)
    );
  }

  // Razmena nije uspela. Za potvrdu naloga / OAuth (podrazumevani next) je
  // prijava rešenje. Za ostale tokove (nova lozinka) link je neupotrebljiv
  // u ovom browseru, pa kažemo da se zatraži nov.
  const fallback = next === "/admin" ? "/prijava?potvrdjen=1" : "/prijava?greska=link";
  return NextResponse.redirect(new URL(fallback, url.origin));
}
