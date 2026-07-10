import {
  Bricolage_Grotesque,
  Cormorant_Garamond,
  DM_Sans,
  DM_Serif_Display,
  Fraunces,
  Inter,
  Josefin_Sans,
  Karla,
  Libre_Baskerville,
  Manrope,
  Nunito,
  Outfit,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google";

// Kurirani font parovi za sajtove salona. preload: false - fajlovi se
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

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  variable: "--font-cormorant",
  preload: false,
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  preload: false,
});

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
  preload: false,
});

const karla = Karla({
  subsets: ["latin", "latin-ext"],
  variable: "--font-karla",
  preload: false,
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
  preload: false,
});

// Libre Baskerville nije variable font - težine se navode eksplicitno
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-libre-baskerville",
  preload: false,
});

const josefin = Josefin_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-josefin",
  preload: false,
});

const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  variable: "--font-nunito",
  preload: false,
});

export { FONT_PAIR_IDS, type FontPairId } from "@/lib/font-ids";
import type { FontPairId } from "@/lib/font-ids";

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
    description: "Geist - neutralno i moderno (podrazumevano)",
    className: "",
    headingVar: "var(--font-geist-sans)",
    sansVar: "var(--font-geist-sans)",
  },
  {
    id: "elegant",
    label: "Elegantno",
    description: "Playfair Display + Inter - otmeno, za beauty salone",
    className: `${playfair.variable} ${inter.variable}`,
    headingVar: "var(--font-playfair)",
    sansVar: "var(--font-inter)",
  },
  {
    id: "modern",
    label: "Moderno",
    description: "Space Grotesk + Inter - oštro i urbano",
    className: `${spaceGrotesk.variable} ${inter.variable}`,
    headingVar: "var(--font-space-grotesk)",
    sansVar: "var(--font-inter)",
  },
  {
    id: "warm",
    label: "Toplo",
    description: "Fraunces + Inter - meko i prijateljski",
    className: `${fraunces.variable} ${inter.variable}`,
    headingVar: "var(--font-fraunces)",
    sansVar: "var(--font-inter)",
  },
  {
    id: "classic",
    label: "Klasično",
    description: "DM Serif + DM Sans - bezvremenska kombinacija",
    className: `${dmSerif.variable} ${dmSans.variable}`,
    headingVar: "var(--font-dm-serif)",
    sansVar: "var(--font-dm-sans)",
  },
  {
    id: "luxury",
    label: "Luksuzno",
    description: "Cormorant Garamond + Manrope - visoka moda, premium saloni",
    className: `${cormorant.variable} ${manrope.variable}`,
    headingVar: "var(--font-cormorant)",
    sansVar: "var(--font-manrope)",
  },
  {
    id: "geometric",
    label: "Geometrijsko",
    description: "Outfit + Karla - čiste linije, savremen studio",
    className: `${outfit.variable} ${karla.variable}`,
    headingVar: "var(--font-outfit)",
    sansVar: "var(--font-karla)",
  },
  {
    id: "bold",
    label: "Odvažno",
    description: "Bricolage Grotesque + Inter - upadljivo, sa karakterom",
    className: `${bricolage.variable} ${inter.variable}`,
    headingVar: "var(--font-bricolage)",
    sansVar: "var(--font-inter)",
  },
  {
    id: "literary",
    label: "Književno",
    description: "Libre Baskerville + Karla - smireno i pouzdano",
    className: `${libreBaskerville.variable} ${karla.variable}`,
    headingVar: "var(--font-libre-baskerville)",
    sansVar: "var(--font-karla)",
  },
  {
    id: "soft",
    label: "Nežno",
    description: "Josefin Sans + Nunito - meko, za spa i negu",
    className: `${josefin.variable} ${nunito.variable}`,
    headingVar: "var(--font-josefin)",
    sansVar: "var(--font-nunito)",
  },
];

export function getFontPair(id: string | undefined): FontPair {
  return FONT_PAIRS.find((p) => p.id === id) ?? FONT_PAIRS[0];
}
