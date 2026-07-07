import { ImageResponse } from "next/og";
import { OG_SIZE, ogFonts, TerminerOgCard } from "@/lib/og";

export const alt = "Terminer - sajt i online zakazivanje za tvoj salon";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(<TerminerOgCard />, {
    ...size,
    fonts: await ogFonts(),
  });
}
