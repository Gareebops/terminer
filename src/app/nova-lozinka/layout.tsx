import type { Metadata } from "next";

// Pomoćna stranica iz mejla za reset - nema šta da traži u indeksu
export const metadata: Metadata = {
  title: "Nova lozinka",
  robots: { index: false, follow: false },
};

export default function NovaLozinkaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
