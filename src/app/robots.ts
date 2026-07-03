import type { MetadataRoute } from "next";

// Privatne rute ne treba da završe u pretraživačima; javni deo
// (landing, sajtovi salona, pravne strane) je otvoren.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/superadmin", "/faktura/", "/onboarding"],
      },
    ],
  };
}
