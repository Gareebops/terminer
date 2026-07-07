import { ImageResponse } from "next/og";
import { brandGradient, gradientForeground } from "@/lib/color";
import { OG_SIZE, ogFonts, TerminerOgCard } from "@/lib/og";
import { createAdminClient } from "@/lib/supabase/admin";

export const alt = "Zakaži termin online";
export const size = OG_SIZE;
export const contentType = "image/png";

// Salon menja ime/boju retko — sat keša je dovoljno svež, a deljenje linka
// ne plaća generisanje svaki put.
export const revalidate = 3600;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fonts = await ogFonts();

  // Service-role umesto anon klijenta: nema cookies() pa slika sme u keš.
  // Vidljivost proveravamo ručno, isto kao getTenantSite (objavljen + nesuspendovan).
  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, is_published, suspended_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant || !tenant.is_published || tenant.suspended_at) {
    return new ImageResponse(<TerminerOgCard />, { ...size, fonts });
  }

  const { data: settings } = await supabase
    .from("site_settings")
    .select("primary_color")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const brand = settings?.primary_color ?? "#18181b";
  const fg = gradientForeground(brand);
  const isLightText = fg === "#ffffff";
  const muted = isLightText ? "rgba(255,255,255,0.7)" : "rgba(24,24,27,0.65)";
  const pillBg = isLightText ? "rgba(255,255,255,0.16)" : "rgba(24,24,27,0.08)";
  const pillBorder = isLightText
    ? "rgba(255,255,255,0.35)"
    : "rgba(24,24,27,0.25)";

  const name = tenant.name as string;
  const nameSize = name.length <= 16 ? 96 : name.length <= 26 ? 76 : 56;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundImage: brandGradient(brand),
          padding: 72,
          fontFamily: "Jakarta",
          color: fg,
        }}
      >
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            border: `2px solid ${pillBorder}`,
            borderRadius: 999,
            padding: "12px 28px",
            fontSize: 26,
            fontWeight: 500,
            color: muted,
          }}
        >
          Online zakazivanje termina
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: nameSize,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.05,
              maxWidth: 1050,
            }}
          >
            {name}
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: muted }}>
            Izaberi uslugu i termin - brzo i bez poziva
          </div>
        </div>

        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              backgroundColor: pillBg,
              border: `2px solid ${pillBorder}`,
              borderRadius: 999,
              padding: "14px 32px",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            terminer.rs/{slug}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
