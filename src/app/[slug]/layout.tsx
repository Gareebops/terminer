import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { displayColor, readableForeground } from "@/lib/color";
import { getFontPair } from "@/lib/fonts";
import { getTenantSite } from "@/lib/tenant";

// SEO za sajt salona: naslov i opis su salonovi, ne Terminerovi.
// getTenantSite je React cache, pa layout ne plaća drugi upit.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getTenantSite(slug);
  if (!site) return {};
  return {
    title: {
      // absolute: bez root "%s | Terminer" šablona - sajt salona nosi svoj brend
      absolute: `${site.tenant.name} - online zakazivanje`,
      template: `%s | ${site.tenant.name}`,
    },
    description:
      site.settings?.hero_subtitle ??
      `${site.tenant.name} - zakaži svoj termin online, brzo i bez poziva.`,
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

  return (
    <div
      data-button-style={theme.button_style ?? "rounded"}
      className={`flex min-h-screen flex-1 flex-col bg-background text-foreground ${fontPair.className} ${mode === "dark" ? "dark" : ""}`}
      style={{
        ["--primary" as string]: accent,
        ["--primary-foreground" as string]: readableForeground(accent),
        ["--ring" as string]: accent,
        ["--app-font-heading" as string]: fontPair.headingVar,
        ["--app-font-sans" as string]: fontPair.sansVar,
      }}
    >
      {children}
    </div>
  );
}
