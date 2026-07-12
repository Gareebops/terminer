import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  brandGradient,
  displayColor,
  gradientForeground,
  mix,
  readableForeground,
} from "@/lib/color";
import { getFontPair } from "@/lib/fonts";
import { plural } from "@/lib/plural";
import { getTenantSite } from "@/lib/tenant";

// SEO za sajt salona: naslov i opis su salonovi, ne Terminerovi.
// getTenantSite je React cache, pa layout ne plaća drugi upit.
// Canonical NIJE ovde (nasledio bi ga i /otkazivanje) - postavljaju ga
// stranice: [slug]/page.tsx i zakazi/page.tsx kroz salonCanonicalBase.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getTenantSite(slug);
  if (!site) return {};
  const city = site.settings?.city?.trim() || null;
  // Grad u naslovu = lokalna pretraga ("frizer + grad") vidi salon
  const title = [site.tenant.name, city, "online zakazivanje"]
    .filter(Boolean)
    .join(" - ");
  // Opis: tekst vlasnika ima prednost; fallback nabraja prve usluge da
  // svaki salon dobije jedinstven, konkretan opis u rezultatima pretrage
  const topServices = site.services.slice(0, 3).map((s) => s.name).join(", ");
  const rest = site.services.length - 3;
  const description =
    site.settings?.hero_subtitle ??
    (topServices
      ? `${site.tenant.name}${city ? `, ${city}` : ""} - pogledaj cenovnik i zakaži termin online: ${topServices}${
          rest > 0
            ? ` i još ${rest} ${plural(rest, ["usluga", "usluge", "usluga"])}`
            : ""
        }.`
      : `${site.tenant.name} - zakaži svoj termin online, brzo i bez poziva.`);
  return {
    title: {
      // absolute: bez root "%s | Terminer" šablona - sajt salona nosi svoj brend
      absolute: title,
      template: `%s | ${site.tenant.name}`,
    },
    description,
    // openGraph iz root layouta se ne nasleđuje po poljima nego zamenjuje ceo,
    // pa deljeni link salona ovde dobija svoj naslov (sliku daje opengraph-image.tsx)
    openGraph: {
      type: "website",
      locale: "sr_RS",
      siteName: site.tenant.name,
      title,
      description,
    },
  };
}

// Tema salona (boja, font par, svetla/tamna varijanta) se primenjuje ovde,
// pa važi za sajt i za booking stranicu. Boja ide u shadcn --primary token
// uz automatski izračunat kontrast teksta; tamna varijanta preko .dark klase.
export default async function SalonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getTenantSite(slug);
  if (!site) notFound();

  const theme = site.settings?.theme ?? {};
  const mode = theme.mode === "dark" ? "dark" : "light";
  const fontPair = getFontPair(theme.font_pair);

  const brand = site.settings?.primary_color ?? "#18181b";
  const accent = displayColor(brand, mode);

  // Skala zaobljenosti: --surface-radius nose ključne javne površine
  // (redovi usluga, galerija, izbori u wizardu), kartice idu kroz
  // globals pravila po data-radius atributu
  const radiusScale = theme.radius_scale ?? "soft";
  const surfaceRadius =
    radiusScale === "sharp" ? "0.125rem" : radiusScale === "round" ? "1rem" : "0.5rem";

  // Tonirana pozadina: jedva primetan dah brenda umesto čiste podloge -
  // dovoljno suptilno da auto-kontrast teksta ostane važeći
  const tintedBackground =
    theme.background === "tinted"
      ? mode === "dark"
        ? mix("#0a0a0a", accent, 0.12)
        : mix("#ffffff", accent, 0.055)
      : null;

  return (
    <div
      data-button-style={theme.button_style ?? "rounded"}
      data-radius={radiusScale}
      data-heading={theme.heading_style ?? "normal"}
      className={`flex min-h-screen flex-1 flex-col bg-background text-foreground ${fontPair.className} ${mode === "dark" ? "dark" : ""}`}
      style={{
        ["--primary" as string]: accent,
        // Suptilan gradijent brenda za pozadinske površine (globals.css);
        // kontrast teksta se računa prema najsvetlijem stopu gradijenta.
        // gradient: false → flat boja (background-image: none)
        ["--primary-gradient" as string]:
          theme.gradient === false ? "none" : brandGradient(accent),
        // Flat: kontrast prema samoj boji; gradijent: prema najsvetlijem stopu
        ["--primary-foreground" as string]:
          theme.gradient === false
            ? readableForeground(accent)
            : gradientForeground(accent),
        ["--ring" as string]: accent,
        ["--surface-radius" as string]: surfaceRadius,
        ...(tintedBackground ? { ["--background" as string]: tintedBackground } : {}),
        ["--app-font-heading" as string]: fontPair.headingVar,
        ["--app-font-sans" as string]: fontPair.sansVar,
      }}
    >
      {children}
    </div>
  );
}
