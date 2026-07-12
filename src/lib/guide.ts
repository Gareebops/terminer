import { plural } from "@/lib/plural";
import type { SiteSettings } from "@/lib/types";

// Model koraka vodiča za pokretanje - JEDAN izvor istine za karticu na
// Početnoj (onboarding-guide) i traku koja prati vlasnika po celom adminu
// (guide-rail). Koraci se štikliraju sami iz stvarnih podataka, pa vodič
// prepoznaje i ono što je vlasnik uradio mimo njega.

export type GuideStepId =
  | "account"
  | "services"
  | "staff"
  | "schedule"
  | "appearance"
  | "publish";

export interface GuideStep {
  id: GuideStepId;
  title: string;
  done: boolean;
  meta?: string;
  desc?: string;
  // Kratko uputstvo u traci vodiča dok je vlasnik NA stranici koraka
  // (tada mu ne treba navigacija nego "šta ovde da uradim")
  hint?: string;
  cta?: { href: string; label: string };
  // Koraci čiji default može stvarno biti dobar (radno vreme, izgled)
  // nude i potvrdu pored CTA - automatska provera defaulta ne postoji,
  // a bez potvrde bi korak blokirao objavu kroz vodič
  confirm?: {
    label: string;
    patch: { scheduleConfirmed?: boolean; appearanceConfirmed?: boolean };
    toast: string;
  };
}

export interface GuideData {
  servicesCount: number;
  staffCount: number;
  scheduleConfirmed: boolean;
  appearanceTouched: boolean;
  appearanceConfirmed: boolean;
  singleStaffId: string | null;
}

export function guideSteps(d: GuideData): GuideStep[] {
  return [
    {
      id: "account",
      title: "Napravi nalog i nazovi salon",
      done: true,
    },
    {
      id: "services",
      title: "Dodaj usluge i cene",
      done: d.servicesCount > 0,
      meta:
        d.servicesCount > 0
          ? `${d.servicesCount} ${plural(d.servicesCount, ["usluga", "usluge", "usluga"])}`
          : undefined,
      desc: "Šišanje, manikir, masaža - šta god radiš. Trajanje određuje koliko termin zauzima u kalendaru.",
      hint: "Dodaj bar jednu uslugu ili ubaci primere - čim sačuvaš, vodič te vodi dalje.",
      cta: { href: "/admin/usluge", label: "Dodaj usluge" },
    },
    {
      id: "staff",
      title: "Dodaj tim",
      done: d.staffCount > 0,
      meta:
        d.staffCount > 0
          ? `${d.staffCount} ${plural(d.staffCount, ["član", "člana", "članova"])}`
          : undefined,
      desc: "I ako radiš sam - ti si tim. Klijenti biraju kod koga zakazuju termin.",
      hint: "Dodaj bar jednog člana tima - i ako radiš sam, ti si tim.",
      cta: { href: "/admin/zaposleni", label: "Dodaj tim" },
    },
    {
      id: "schedule",
      title: "Proveri radno vreme i smene",
      done: d.scheduleConfirmed,
      desc: "Novi član tima automatski dobija pon-sub 09-20. Ako salon radi drugačije ili neko radi u smenama, promeni to kod zaposlenog - od radnog vremena se prave slobodni termini.",
      hint: "Od radnog vremena se prave slobodni termini - sačuvaj izmenu ili potvrdi da je već tačno.",
      cta: {
        href: d.singleStaffId
          ? `/admin/zaposleni/${d.singleStaffId}`
          : "/admin/zaposleni",
        label: "Proveri radno vreme",
      },
      confirm: {
        label: "Već je tačno",
        patch: { scheduleConfirmed: true },
        toast: "Radno vreme je potvrđeno.",
      },
    },
    {
      id: "appearance",
      title: "Doteraj izgled sajta",
      done: d.appearanceTouched || d.appearanceConfirmed,
      desc: "Boja brenda, slike i kontakt podaci - da sajt liči baš na tvoj salon.",
      hint: "Boja brenda, slike i kontakt - ili potvrdi ako ti se sviđa ovako.",
      cta: { href: "/admin/podesavanja", label: "Otvori izgled" },
      confirm: {
        label: "Sviđa mi se ovako",
        patch: { appearanceConfirmed: true },
        toast: "Izgled je potvrđen.",
      },
    },
    {
      id: "publish",
      title: "Pogledaj sajt i objavi ga",
      done: false,
      desc: "Proveri kako izgleda klijentima, pa ga pusti na mrežu jednim klikom.",
      // Dugme za objavu živi na Početnoj (kartica vodiča drži dijalog i
      // proslavu) - traka zato vodi tamo
      cta: { href: "/admin", label: "Objavi sajt" },
    },
  ];
}

// Sledeći nezavršen korak; completedId tretira upravo završen korak kao
// gotov (poziva se pre nego što revalidacija donese svež count)
export function nextGuideStep(
  d: GuideData,
  completedId?: GuideStepId
): GuideStep | null {
  return guideSteps(d).find((s) => !s.done && s.id !== completedId) ?? null;
}

// Sve što dijalogu "Korak završen" treba da povede na sledeći korak:
// kuda dalje + napredak POSLE upravo završenog koraka
export interface GuideNextInfo {
  href: string;
  label: string;
  title: string;
  doneAfter: number;
  total: number;
}

export function guideNextInfo(
  d: GuideData,
  completedId: GuideStepId
): GuideNextInfo | null {
  const steps = guideSteps(d);
  const next = steps.find((s) => !s.done && s.id !== completedId);
  if (!next?.cta) return null;
  return {
    href: next.cta.href,
    label: next.cta.label,
    title: next.title,
    doneAfter: steps.filter((s) => s.done || s.id === completedId).length,
    total: steps.length,
  };
}

// Da li se korak obavlja na datoj admin stranici - traka tada umesto
// navigacije prikazuje uputstvo (i potvrdu, ako je korak ima)
export function stepMatchesPath(id: GuideStepId, pathname: string): boolean {
  switch (id) {
    case "services":
      return pathname.startsWith("/admin/usluge");
    case "staff":
      return pathname.startsWith("/admin/zaposleni");
    case "schedule":
      return (
        pathname.startsWith("/admin/zaposleni") ||
        pathname.startsWith("/admin/raspored")
      );
    case "appearance":
      return pathname.startsWith("/admin/podesavanja");
    case "publish":
      return pathname === "/admin";
    default:
      return false;
  }
}

// Heuristika "dirnut izgled": bilo koji trag da je vlasnik radio na sajtu.
// PAZI: theme ima default '{}' pa se proverava broj ključeva.
export function isAppearanceTouched(settings: SiteSettings | null): boolean {
  return !!(
    settings &&
    (settings.logo_url ||
      settings.hero_image_url ||
      (settings.theme && Object.keys(settings.theme).length > 0) ||
      settings.phone ||
      settings.address ||
      settings.primary_color !== "#18181b")
  );
}
