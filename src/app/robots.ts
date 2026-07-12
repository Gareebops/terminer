import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Privatne rute ne treba da završe u pretraživačima; javni deo
// (landing, sajtovi salona, pravne strane) je otvoren. Stranice sa
// tokenima/formama (otkazivanje, nova-lozinka...) nose meta noindex
// umesto disallow - robots blokada bi sakrila i sam noindex signal.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/superadmin", "/faktura/", "/onboarding"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
