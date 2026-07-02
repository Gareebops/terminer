import {
  DM_Sans,
  DM_Serif_Display,
  Fraunces,
  Inter,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google";

// Kurirani font parovi za sajtove salona. preload: false — fajlovi se
// povlače tek kada je par stvarno primenjen na stranici salona.

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  preload: false,
});

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  preload: false,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-space-grotesk",
  preload: false,
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  preload: false,
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-dm-serif",
  preload: false,
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  preload: false,
});

export type FontPairId = "geist" | "elegant" | "modern" | "warm" | "classic";

export interface FontPair {
  id: FontPairId;
  label: string;
  description: string;
  // CSS klase koje registruju font varijable na wrapperu
  className: string;
  // Vrednosti za --app-font-heading / --app-font-sans
  headingVar: string;
  sansVar: string;
}

export const FONT_PAIRS: FontPair[] = [
  {
    id: "geist",
    label: "Čisto",
    description: "Geist — neutralno i moderno (podrazumevano)",
    className: "",
    headingVar: "var(--font-geist-sans)",
    sansVar: "var(--font-geist-sans)",
  },
  {
    id: "elegant",
    label: "Elegantno",
    description: "Playfair Display + Inter — otmeno, za beauty salone",
    className: `${playfair.variable} ${inter.variable}`,
    headingVar: "var(--font-playfair)",
    sansVar: "var(--font-inter)",
  },
  {
    id: "modern",
    label: "Moderno",
    description: "Space Grotesk + Inter — oštro, za barbershope",
    className: `${spaceGrotesk.variable} ${inter.variable}`,
    headingVar: "var(--font-space-grotesk)",
    sansVar: "var(--font-inter)",
  },
  {
    id: "warm",
    label: "Toplo",
    description: "Fraunces + Inter — meko i prijateljski",
    className: `${fraunces.variable} ${inter.variable}`,
    headingVar: "var(--font-fraunces)",
    sansVar: "var(--font-inter)",
  },
  {
    id: "classic",
    label: "Klasično",
    description: "DM Serif + DM Sans — bezvremenska kombinacija",
    className: `${dmSerif.variable} ${dmSans.variable}`,
    headingVar: "var(--font-dm-serif)",
    sansVar: "var(--font-dm-sans)",
  },
];

export function getFontPair(id: string | undefined): FontPair {
  return FONT_PAIRS.find((p) => p.id === id) ?? FONT_PAIRS[0];
}
