import { ImageResponse } from "next/og";
import { readableForeground } from "@/lib/color";
import { ogFonts } from "@/lib/og";
import { createAdminClient } from "@/lib/supabase/admin";

// Favicon sajta salona: logo salona kad je objavljen i ima logo; bez logoa
// monogram (prvo slovo na boji brenda); neobjavljen/nepostojeći salon dobija
// Terminer znak (bez curenja podataka neobjavljenog salona).
//
// Logo ide kroz redirect (ne kroz ImageResponse) - satori ne podržava WebP,
// a lib/image.ts konvertuje sve upload-e u WebP.
// Bez `size`/`contentType` exporta: format i dimenzije zavise od putanje.

// Kratko: posle objave salona favicon treba brzo da se prevrne na logo
export const revalidate = 300;

const ICON = { width: 64, height: 64 };
// ImageResponse bi default-no poslao immutable keš od godinu dana -
// monogram/fallback bi ostao zalepljen u browseru i posle dodavanja logoa
const CACHE_HEADERS = { "Cache-Control": "public, max-age=300" };

function markResponse(
  bg: string,
  fg: string,
  letter: string,
  fonts: Awaited<ReturnType<typeof ogFonts>>
) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderRadius: 14,
          color: fg,
          fontFamily: "Jakarta",
          fontSize: 38,
          fontWeight: 800,
        }}
      >
        {letter}
      </div>
    ),
    { ...ICON, fonts, headers: CACHE_HEADERS }
  );
}

export default async function Icon({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("id, name, is_published, suspended_at")
    .eq("slug", slug)
    .maybeSingle();

  // Ista vidljivost kao getTenantSite: neobjavljen/suspendovan salon za
  // javnost ne postoji, pa ni njegov favicon
  if (!tenant || !tenant.is_published || tenant.suspended_at) {
    return markResponse("#17181A", "#A6F5A6", "T", await ogFonts());
  }

  const { data: settings } = await db
    .from("site_settings")
    .select("logo_url, primary_color")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (settings?.logo_url) {
    // Redirect na Next image optimizer umesto sirovih bajtova: logo ume da
    // bude ogroman (demo: 3.6MB PNG), a favicon treba par KB na 64px.
    // Relativan Location je legalan i radi na svakom hostu/domenu.
    const optimized = `/_next/image?url=${encodeURIComponent(settings.logo_url)}&w=64&q=75`;
    return new Response(null, {
      status: 302,
      headers: { Location: optimized, ...CACHE_HEADERS },
    });
  }

  const brand = settings?.primary_color ?? "#18181b";
  const letter = tenant.name.trim().charAt(0).toUpperCase() || "S";
  return markResponse(brand, readableForeground(brand), letter, await ogFonts());
}
