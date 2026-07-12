import { describe, expect, it } from "vitest";
import {
  guideNextInfo,
  guideSteps,
  isAppearanceTouched,
  nextGuideStep,
  stepMatchesPath,
  type GuideData,
} from "./guide";
import type { SiteSettings } from "./types";

const fresh: GuideData = {
  servicesCount: 0,
  staffCount: 0,
  scheduleConfirmed: false,
  appearanceTouched: false,
  appearanceConfirmed: false,
  singleStaffId: null,
};

describe("guideSteps", () => {
  it("svež salon: samo nalog je gotov, redosled koraka fiksan", () => {
    const steps = guideSteps(fresh);
    expect(steps.map((s) => s.id)).toEqual([
      "account",
      "services",
      "staff",
      "schedule",
      "appearance",
      "publish",
    ]);
    expect(steps.filter((s) => s.done).map((s) => s.id)).toEqual(["account"]);
  });

  it("meta broji usluge i članove sa pravilnom množinom", () => {
    const steps = guideSteps({ ...fresh, servicesCount: 2, staffCount: 5 });
    expect(steps.find((s) => s.id === "services")?.meta).toBe("2 usluge");
    expect(steps.find((s) => s.id === "staff")?.meta).toBe("5 članova");
  });

  it("korak radnog vremena vodi pravo na jedinog zaposlenog", () => {
    const one = guideSteps({ ...fresh, staffCount: 1, singleStaffId: "abc" });
    expect(one.find((s) => s.id === "schedule")?.cta?.href).toBe(
      "/admin/zaposleni/abc"
    );
    const many = guideSteps({ ...fresh, staffCount: 3 });
    expect(many.find((s) => s.id === "schedule")?.cta?.href).toBe(
      "/admin/zaposleni"
    );
  });

  it("izgled je gotov i kroz izmenu i kroz potvrdu", () => {
    const touched = guideSteps({ ...fresh, appearanceTouched: true });
    expect(touched.find((s) => s.id === "appearance")?.done).toBe(true);
    const confirmed = guideSteps({ ...fresh, appearanceConfirmed: true });
    expect(confirmed.find((s) => s.id === "appearance")?.done).toBe(true);
  });

  it("objava nikad nije done (kartica se krije tek objavom sajta)", () => {
    const all: GuideData = {
      servicesCount: 3,
      staffCount: 1,
      scheduleConfirmed: true,
      appearanceTouched: true,
      appearanceConfirmed: false,
      singleStaffId: "x",
    };
    expect(guideSteps(all).find((s) => s.id === "publish")?.done).toBe(false);
  });
});

describe("nextGuideStep", () => {
  it("bez completedId vraća prvi nezavršen korak", () => {
    expect(nextGuideStep(fresh)?.id).toBe("services");
  });

  it("completedId preskače upravo završen korak i pre svežeg counta", () => {
    // Toast "Sačuvano" se prikazuje pre nego što revalidacija donese nov count
    expect(nextGuideStep(fresh, "services")?.id).toBe("staff");
    expect(
      nextGuideStep({ ...fresh, servicesCount: 2, staffCount: 1 }, "schedule")?.id
    ).toBe("appearance");
  });

  it("kad je sve spremno, sledeći je objava (cta vodi na Početnu)", () => {
    const ready: GuideData = {
      servicesCount: 1,
      staffCount: 1,
      scheduleConfirmed: true,
      appearanceTouched: false,
      appearanceConfirmed: true,
      singleStaffId: "x",
    };
    const next = nextGuideStep(ready);
    expect(next?.id).toBe("publish");
    expect(next?.cta?.href).toBe("/admin");
  });
});

describe("guideNextInfo", () => {
  it("nosi CTA sledećeg koraka i napredak POSLE završenog", () => {
    // Svež salon završava usluge: gotovi su nalog + usluge = 2 od 6
    const info = guideNextInfo(fresh, "services");
    expect(info).toEqual({
      href: "/admin/zaposleni",
      label: "Dodaj tim",
      title: "Dodaj tim",
      doneAfter: 2,
      total: 6,
    });
  });

  it("posle poslednjeg pripremnog koraka vodi na objavu (Početna)", () => {
    const info = guideNextInfo(
      {
        servicesCount: 8,
        staffCount: 1,
        scheduleConfirmed: true,
        appearanceTouched: false,
        appearanceConfirmed: false,
        singleStaffId: "x",
      },
      "appearance"
    );
    expect(info?.href).toBe("/admin");
    expect(info?.label).toBe("Objavi sajt");
    expect(info?.doneAfter).toBe(5);
  });
});

describe("stepMatchesPath", () => {
  it("prepoznaje stranicu koraka, uključujući detalj zaposlenog", () => {
    expect(stepMatchesPath("services", "/admin/usluge")).toBe(true);
    expect(stepMatchesPath("staff", "/admin/zaposleni")).toBe(true);
    expect(stepMatchesPath("schedule", "/admin/zaposleni/abc")).toBe(true);
    expect(stepMatchesPath("schedule", "/admin/raspored")).toBe(true);
    expect(stepMatchesPath("appearance", "/admin/podesavanja")).toBe(true);
  });

  it("tuđe stranice ne matchuju", () => {
    expect(stepMatchesPath("services", "/admin/kalendar")).toBe(false);
    expect(stepMatchesPath("appearance", "/admin")).toBe(false);
    expect(stepMatchesPath("account", "/admin")).toBe(false);
  });
});

describe("isAppearanceTouched", () => {
  const base = {
    logo_url: null,
    hero_image_url: null,
    theme: {},
    phone: null,
    address: null,
    primary_color: "#18181b",
  } as unknown as SiteSettings;

  it("default podešavanja nisu dirnuta (theme '{}' se ne računa)", () => {
    expect(isAppearanceTouched(null)).toBe(false);
    expect(isAppearanceTouched(base)).toBe(false);
  });

  it("bilo koji trag rada pali heuristiku", () => {
    expect(isAppearanceTouched({ ...base, logo_url: "x.png" })).toBe(true);
    expect(isAppearanceTouched({ ...base, phone: "0601234567" })).toBe(true);
    expect(
      isAppearanceTouched({ ...base, theme: { mode: "dark" } })
    ).toBe(true);
    expect(
      isAppearanceTouched({ ...base, primary_color: "#b45309" })
    ).toBe(true);
  });
});
