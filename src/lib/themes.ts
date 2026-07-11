import type { FontPairId } from "@/lib/font-ids";
import type {
  BackgroundStyle,
  ButtonStyle,
  HeadingStyle,
  RadiusScale,
} from "@/lib/types";

// Kurirane teme sajta salona: svaka je kompletan paket tokena koji
// updateAppearance ume da primeni odjednom. Teme žive u kodu (ne u bazi)
// da bi bile verzionisane i testirane; primena RASPAKUJE tokene u
// site_settings pa kasnija izmena teme ne pomera postojeće salone.
// Kontrast je bezbedan po konstrukciji: boja ide kroz displayColor +
// readable/gradientForeground u [slug]/layout kao i ručni izbor.

export type Delatnost =
  | "frizerski"
  | "barbershop"
  | "kozmetika"
  | "masaza"
  | "univerzalno";

export interface SiteThemePreset {
  id: string;
  label: string;
  primaryColor: string;
  fontPair: FontPairId;
  mode: "light" | "dark";
  buttonStyle: ButtonStyle;
  radiusScale: RadiusScale;
  background: BackgroundStyle;
  headingStyle: HeadingStyle;
  gradient: boolean;
  // Kojim delatnostima tema "leži" - predlog bira iz ovog pula
  delatnosti: Delatnost[];
}

export const SITE_THEMES: SiteThemePreset[] = [
  { id: "ponoc", label: "Ponoć", primaryColor: "#18181b", fontPair: "elegant", mode: "dark", buttonStyle: "pill", radiusScale: "soft", background: "plain", headingStyle: "normal", gradient: false, delatnosti: ["barbershop", "frizerski"] },
  { id: "zlatni-rez", label: "Zlatni rez", primaryColor: "#b45309", fontPair: "luxury", mode: "dark", buttonStyle: "pill", radiusScale: "round", background: "tinted", headingStyle: "caps", gradient: true, delatnosti: ["frizerski", "kozmetika"] },
  { id: "pastel", label: "Pastel", primaryColor: "#b0679c", fontPair: "warm", mode: "light", buttonStyle: "rounded", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: true, delatnosti: ["kozmetika"] },
  { id: "studio", label: "Studio", primaryColor: "#111827", fontPair: "modern", mode: "light", buttonStyle: "square", radiusScale: "sharp", background: "plain", headingStyle: "caps", gradient: false, delatnosti: ["frizerski", "barbershop"] },
  { id: "bordo", label: "Bordo", primaryColor: "#881337", fontPair: "classic", mode: "light", buttonStyle: "rounded", radiusScale: "soft", background: "plain", headingStyle: "normal", gradient: true, delatnosti: ["univerzalno"] },
  { id: "lavanda", label: "Lavanda", primaryColor: "#6b21a8", fontPair: "soft", mode: "light", buttonStyle: "pill", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: true, delatnosti: ["kozmetika", "masaza"] },
  { id: "maslina", label: "Maslina", primaryColor: "#3f6212", fontPair: "literary", mode: "light", buttonStyle: "rounded", radiusScale: "soft", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["masaza"] },
  { id: "okean", label: "Okean", primaryColor: "#0e7490", fontPair: "geometric", mode: "light", buttonStyle: "rounded", radiusScale: "soft", background: "plain", headingStyle: "normal", gradient: true, delatnosti: ["univerzalno"] },
  { id: "terakota", label: "Terakota", primaryColor: "#c2410c", fontPair: "warm", mode: "light", buttonStyle: "rounded", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: true, delatnosti: ["frizerski"] },
  { id: "grafit", label: "Grafit", primaryColor: "#374151", fontPair: "bold", mode: "dark", buttonStyle: "square", radiusScale: "sharp", background: "plain", headingStyle: "caps", gradient: false, delatnosti: ["barbershop"] },
  { id: "roze-zlato", label: "Roze zlato", primaryColor: "#be5985", fontPair: "luxury", mode: "light", buttonStyle: "pill", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: true, delatnosti: ["kozmetika"] },
  { id: "smaragd", label: "Smaragd", primaryColor: "#065f46", fontPair: "elegant", mode: "dark", buttonStyle: "pill", radiusScale: "soft", background: "plain", headingStyle: "normal", gradient: true, delatnosti: ["univerzalno"] },
  { id: "pesak", label: "Pesak", primaryColor: "#a16207", fontPair: "soft", mode: "light", buttonStyle: "rounded", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["masaza"] },
  { id: "indigo", label: "Indigo", primaryColor: "#312e81", fontPair: "modern", mode: "dark", buttonStyle: "rounded", radiusScale: "sharp", background: "plain", headingStyle: "caps", gradient: true, delatnosti: ["frizerski"] },
  { id: "tresnja", label: "Trešnja", primaryColor: "#9f1239", fontPair: "bold", mode: "light", buttonStyle: "pill", radiusScale: "soft", background: "plain", headingStyle: "normal", gradient: true, delatnosti: ["frizerski", "kozmetika"] },
  { id: "menta", label: "Menta", primaryColor: "#0d9488", fontPair: "geometric", mode: "light", buttonStyle: "pill", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["kozmetika", "masaza"] },
  { id: "espreso", label: "Espreso", primaryColor: "#44403c", fontPair: "classic", mode: "light", buttonStyle: "rounded", radiusScale: "soft", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["barbershop", "frizerski"] },
  { id: "safir", label: "Safir", primaryColor: "#1e3a8a", fontPair: "elegant", mode: "light", buttonStyle: "rounded", radiusScale: "soft", background: "plain", headingStyle: "normal", gradient: true, delatnosti: ["univerzalno"] },
  { id: "moka", label: "Moka", primaryColor: "#78350f", fontPair: "literary", mode: "dark", buttonStyle: "rounded", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: true, delatnosti: ["masaza", "barbershop"] },
  { id: "neonska-noc", label: "Neonska noć", primaryColor: "#7c3aed", fontPair: "bold", mode: "dark", buttonStyle: "pill", radiusScale: "sharp", background: "plain", headingStyle: "caps", gradient: true, delatnosti: ["frizerski"] },
  { id: "porcelan", label: "Porcelan", primaryColor: "#64748b", fontPair: "luxury", mode: "light", buttonStyle: "square", radiusScale: "sharp", background: "plain", headingStyle: "normal", gradient: false, delatnosti: ["kozmetika"] },
  { id: "sumska", label: "Šumska", primaryColor: "#14532d", fontPair: "warm", mode: "dark", buttonStyle: "rounded", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["masaza"] },
  { id: "koral", label: "Koral", primaryColor: "#be123c", fontPair: "soft", mode: "light", buttonStyle: "pill", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: true, delatnosti: ["kozmetika"] },
  { id: "celik", label: "Čelik", primaryColor: "#0f172a", fontPair: "modern", mode: "light", buttonStyle: "square", radiusScale: "sharp", background: "plain", headingStyle: "caps", gradient: false, delatnosti: ["barbershop", "univerzalno"] },
  // Drugi talas (11.7): 15 tema iz dizajn revizije (5 dizajnera × delatnost
  // + art direktor za dedup/ukus/distribuciju) - nove familije boja i sklopovi
  { id: "elektrik", label: "Elektrik", primaryColor: "#2563eb", fontPair: "geometric", mode: "dark", buttonStyle: "square", radiusScale: "sharp", background: "plain", headingStyle: "caps", gradient: false, delatnosti: ["frizerski", "barbershop"] },
  { id: "sljiva", label: "Šljiva", primaryColor: "#7d2a5b", fontPair: "elegant", mode: "light", buttonStyle: "pill", radiusScale: "round", background: "tinted", headingStyle: "caps", gradient: true, delatnosti: ["frizerski", "kozmetika"] },
  { id: "orhideja", label: "Orhideja", primaryColor: "#86198f", fontPair: "elegant", mode: "dark", buttonStyle: "pill", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: true, delatnosti: ["kozmetika", "frizerski"] },
  { id: "kesten", label: "Kesten", primaryColor: "#7b382c", fontPair: "warm", mode: "light", buttonStyle: "rounded", radiusScale: "soft", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["frizerski"] },
  { id: "stara-skola", label: "Stara škola", primaryColor: "#7a2e22", fontPair: "literary", mode: "light", buttonStyle: "square", radiusScale: "sharp", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["barbershop", "frizerski"] },
  { id: "klub", label: "Klub", primaryColor: "#1f4a3d", fontPair: "luxury", mode: "dark", buttonStyle: "rounded", radiusScale: "soft", background: "plain", headingStyle: "normal", gradient: false, delatnosti: ["barbershop"] },
  { id: "zilet", label: "Žilet", primaryColor: "#b01e28", fontPair: "bold", mode: "light", buttonStyle: "square", radiusScale: "sharp", background: "plain", headingStyle: "caps", gradient: false, delatnosti: ["barbershop", "frizerski"] },
  { id: "denim", label: "Denim", primaryColor: "#345a7c", fontPair: "geist", mode: "light", buttonStyle: "rounded", radiusScale: "soft", background: "plain", headingStyle: "normal", gradient: false, delatnosti: ["barbershop", "univerzalno"] },
  { id: "zalfija", label: "Žalfija", primaryColor: "#52796f", fontPair: "geist", mode: "light", buttonStyle: "rounded", radiusScale: "soft", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["kozmetika", "masaza", "univerzalno"] },
  { id: "nebo", label: "Nebo", primaryColor: "#0284c7", fontPair: "soft", mode: "light", buttonStyle: "pill", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: true, delatnosti: ["kozmetika"] },
  { id: "laguna", label: "Laguna", primaryColor: "#2f5f6e", fontPair: "soft", mode: "light", buttonStyle: "pill", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["masaza", "kozmetika"] },
  { id: "ruzmarin", label: "Ruzmarin", primaryColor: "#5f7052", fontPair: "warm", mode: "light", buttonStyle: "rounded", radiusScale: "soft", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["masaza"] },
  { id: "suton", label: "Suton", primaryColor: "#7e4a63", fontPair: "luxury", mode: "dark", buttonStyle: "pill", radiusScale: "round", background: "tinted", headingStyle: "normal", gradient: true, delatnosti: ["masaza", "kozmetika"] },
  { id: "glina", label: "Glina", primaryColor: "#96604a", fontPair: "geist", mode: "light", buttonStyle: "rounded", radiusScale: "soft", background: "plain", headingStyle: "normal", gradient: false, delatnosti: ["masaza"] },
  { id: "petrolej", label: "Petrolej", primaryColor: "#0f4c5c", fontPair: "classic", mode: "dark", buttonStyle: "rounded", radiusScale: "soft", background: "tinted", headingStyle: "normal", gradient: false, delatnosti: ["univerzalno", "barbershop"] },
];

// Ključne reči po delatnosti - bodovanje preko naziva usluga salona.
// Namerno jednostavno: dovoljno da predlog pogodi ton, a "univerzalno"
// je uvek u pulu pa promašaj kategorije nikad ne daje ružan rezultat.
const KLJUCNE_RECI: Record<Exclude<Delatnost, "univerzalno">, string[]> = {
  barbershop: ["brad", "brija", "fade", "barber", "trimer"],
  frizerski: ["šišanje", "sisanje", "farbanje", "pramen", "feniranje", "frizura", "balayage", "kosa", "lokne"],
  kozmetika: ["nokt", "manikir", "pedikir", "trepavic", "obrv", "lice", "depilacij", "šminka", "sminka", "piling"],
  masaza: ["masaž", "masaz", "spa", "aromater", "relaks", "tretman tela"],
};

export function prepoznajDelatnost(nazivUsluga: string[]): Delatnost {
  const tekst = nazivUsluga.join(" ").toLowerCase();
  let najbolja: Delatnost = "univerzalno";
  let najvise = 0;
  for (const [delatnost, reci] of Object.entries(KLJUCNE_RECI) as [Delatnost, string[]][]) {
    const poena = reci.reduce((n, rec) => n + (tekst.includes(rec) ? 1 : 0), 0);
    if (poena > najvise) {
      najvise = poena;
      najbolja = delatnost;
    }
  }
  return najbolja;
}

// Predlog teme: pul = teme delatnosti + univerzalne. exclude prima id
// trenutno primenjene teme ILI celu listu već prikazanih (prvi element =
// trenutno primenjena) - klijent pamti šta je korisnik video pa se predlozi
// ne vrte u krug; tek kad se pul potroši, krug kreće iznova.
export function predloziTemu(
  nazivUsluga: string[],
  exclude?: string | string[]
): { tema: SiteThemePreset; delatnost: Delatnost } {
  const delatnost = prepoznajDelatnost(nazivUsluga);
  const pul = SITE_THEMES.filter(
    (t) => t.delatnosti.includes(delatnost) || t.delatnosti.includes("univerzalno")
  );
  const iskljucene = [exclude ?? []].flat().filter(Boolean) as string[];
  let kandidati = pul.filter((t) => !iskljucene.includes(t.id));
  if (kandidati.length === 0) {
    // Sve viđeno - novi krug, ali trenutno primenjena tema se ne nudi
    kandidati = pul.filter((t) => t.id !== iskljucene[0]);
  }
  if (kandidati.length === 0) kandidati = pul;
  const tema = kandidati[Math.floor(Math.random() * kandidati.length)];
  return { tema, delatnost };
}

export const DELATNOST_LABELS: Record<Delatnost, string> = {
  frizerski: "frizerski salon",
  barbershop: "barbershop",
  kozmetika: "kozmetički salon",
  masaza: "masaža i spa",
  univerzalno: "salon",
};
