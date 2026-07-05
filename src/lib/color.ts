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

// ---------- Suptilan gradijent brenda ----------
// Od jedne izabrane boje se izvodi blagi dijagonalni gradijent iste nijanse
// (svetlija → osnovna → tamnija). Primenjuje se SAMO na pozadinske površine
// sajta salona ([data-button-style] .bg-primary u globals.css); tekst i
// ivice ostaju solid --primary radi čitljivosti.

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const to255 = (v: number) => v * 255;
  const [r, g, b] = [f(0), f(8), f(4)].map(to255);
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

// Pomeraj svetline uz klampovanje - nijansa i zasićenje ostaju isti
function shiftLightness(hex: string, delta: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0.02, Math.min(0.98, l + delta)));
}

export function brandGradientStops(hex: string): { light: string; dark: string } {
  return { light: shiftLightness(hex, 0.07), dark: shiftLightness(hex, -0.08) };
}

export function brandGradient(hex: string): string {
  const { light, dark } = brandGradientStops(hex);
  return `linear-gradient(135deg, ${light} 0%, ${hex} 55%, ${dark} 100%)`;
}

// Tekst preko gradijenta: kontrast se ceni prema NAJSVETLIJEM stopu (najteži
// slučaj za beli tekst), pa je čitljiv preko cele površine
export function gradientForeground(hex: string): string {
  return readableForeground(brandGradientStops(hex).light);
}
