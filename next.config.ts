import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage (tenant-media bucket)
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // SAMEORIGIN (ne DENY): pregled sajta u Podešavanjima renderuje
          // javni sajt u same-origin iframe-u i mora da nastavi da radi
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Ništa od ovoga ne koristimo; eksplicitna zabrana i za embed kontekste
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
