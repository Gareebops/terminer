import type { Metadata } from "next";

// Pomoćna stranica - nema šta da traži u indeksu pretraživača
export const metadata: Metadata = {
  title: "Zaboravljena lozinka",
  robots: { index: false, follow: false },
};

export default function ZaboravljenaLozinkaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
