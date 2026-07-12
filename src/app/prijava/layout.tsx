import type { Metadata } from "next";

// Stranica je client komponenta ("use client") pa metadata živi u layoutu
export const metadata: Metadata = {
  title: "Prijava",
  description:
    "Prijavi se u svoj Terminer nalog i upravljaj salonom, terminima i rasporedom.",
  alternates: { canonical: "/prijava" },
};

export default function PrijavaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
