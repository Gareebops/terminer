// ID-jevi font parova, odvojeni od fonts.ts: next/font ne radi van Next
// runtime-a, a ove konstante trebaju i Zod šemi (admin akcije), katalogu
// tema i unit testovima.
export const FONT_PAIR_IDS = [
  "geist",
  "elegant",
  "modern",
  "warm",
  "classic",
  "luxury",
  "geometric",
  "bold",
  "literary",
  "soft",
] as const;

export type FontPairId = (typeof FONT_PAIR_IDS)[number];
