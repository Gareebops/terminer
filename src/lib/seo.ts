import type { PublicTenant } from "@/lib/types";

// Osnova za apsolutne javne URL-ove (canonical, JSON-LD, sitemap)
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://terminer.rs";

// JSON-LD se renderuje kroz dangerouslySetInnerHTML, a nosi i sadržaj koji
// unosi vlasnik salona (nazivi usluga, opisi) - escape sprečava da
// "</script>" iz podataka prekine tag i ubaci markup u stranicu.
export function jsonLdString(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// Kanonska adresa sajta salona. Custom domen i terminer.rs/{slug} služe
// ISTI sadržaj (proxy rewrite) - bez canonical taga bi ih pretraživači
// tretirali kao duplikate. Kad salon poveže svoj domen, on je kanonski
// (to je adresa koju salon reklamira); inače platformska putanja.
export function salonCanonicalBase(
  tenant: Pick<PublicTenant, "slug" | "custom_domain">
): string {
  return tenant.custom_domain
    ? `https://${tenant.custom_domain}`
    : `${SITE_URL}/${tenant.slug}`;
}
