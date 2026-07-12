import type { Metadata } from "next";

// Stranica je client komponenta ("use client") pa metadata živi u layoutu.
// Registracija je u sitemap-u - naslov i opis su joj ulazna tačka iz pretrage.
export const metadata: Metadata = {
  title: "Registracija - napravi sajt za svoj salon",
  description:
    "Napravi sajt sa online zakazivanjem za svoj salon ili studio. Prvih 30 dana besplatno, bez kartice i bez obaveze.",
  alternates: { canonical: "/registracija" },
};

export default function RegistracijaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
