// Terminer dizajn tokeni — preslikani iz web globals.css (fintech DS).
// Pravila: spoljne kartice 32px radius, unutrašnje 16px, dugmad/bedževi pill,
// JEDNA tamna kartica po ekranu, mint = pozitivno/CTA, lavanda = sekundarno.
export const Colors = {
  canvas: "#E4E9E0",
  ink: "#17181A",
  mint: "#A6F5A6",
  lavender: "#B7A9F2",
  white: "#FFFFFF",
  surface: "#F1F4EF",
  muted: "rgba(23, 24, 26, 0.55)",
  faint: "rgba(23, 24, 26, 0.08)",
  inkOnDarkMuted: "rgba(255, 255, 255, 0.65)",
} as const;

export const Radius = {
  outer: 32,
  inner: 16,
  pill: 999,
} as const;

export const Font = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
