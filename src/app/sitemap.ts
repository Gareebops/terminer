import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

// Landing + pravne strane + svi objavljeni saloni. Service-role klijent da
// lista ne zavisi od sesije; vidljivost ista kao za javnost (objavljen +
// nesuspendovan). Sat keša — novi salon uđe u sitemap najkasnije za sat.
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://terminer.rs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/registracija`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/privatnost`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/uslovi`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const { data: tenants } = await createAdminClient()
    .from("tenants")
    .select("slug")
    .eq("is_published", true)
    .is("suspended_at", null)
    .order("created_at");

  const salonPages: MetadataRoute.Sitemap = (tenants ?? []).flatMap(
    ({ slug }) => [
      {
        url: `${BASE_URL}/${slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      {
        url: `${BASE_URL}/${slug}/zakazi`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      },
    ]
  );

  return [...staticPages, ...salonPages];
}
