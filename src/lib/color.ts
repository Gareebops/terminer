// Pomoćne funkcije za rad sa bojom brenda: automatski kontrast teksta
// i korekcija pretamnih boja u tamnoj varijanti sajta.

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// WCAG relativna luminansa (0 = crno, 1 = belo)
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Beli ili tamni tekst na datoj pozadini - šta god ima bolji kontrast
export function readableForeground(bgHex: string): string {
  return luminance(bgHex) > 0.4 ? "#18181b" : "#ffffff";
}

export function mix(hexA: string, hexB: string, ratio: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(
    a[0] + (b[0] - a[0]) * ratio,
    a[1] + (b[1] - a[1]) * ratio,
    a[2] + (b[2] - a[2]) * ratio
  );
}

// Boja brenda prilagođena varijanti sajta: pretamna boja se na tamnoj
// pozadini ne vidi, pa je posvetlimo; preblede posvetlimo na svetloj.
export function displayColor(hex: string, mode: "light" | "dark"): string {
  const lum = luminance(hex);
  if (mode === "dark" && lum < 0.08) return mix(hex, "#ffffff", 0.45);
  if (mode === "light" && lum > 0.85) return mix(hex, "#18181b", 0.5);
  return hex;
}
