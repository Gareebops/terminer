import { describe, expect, it } from "vitest";
import { FONT_PAIR_IDS } from "./font-ids";
import {
  DELATNOST_LABELS,
  prepoznajDelatnost,
  predloziTemu,
  SITE_THEMES,
  type Delatnost,
} from "./themes";

// Teme su kurirani katalog - svaka mora biti validan paket tokena, inače
// predlog može da upiše vrednost koju updateAppearance šema odbija.

describe("SITE_THEMES katalog", () => {
  it("id-jevi su jedinstveni", () => {
    const ids = SITE_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("svaka tema je validan paket tokena", () => {
    const fontIds = new Set<string>(FONT_PAIR_IDS);
    for (const t of SITE_THEMES) {
      expect(t.primaryColor, t.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(fontIds.has(t.fontPair), `${t.id}: fontPair ${t.fontPair}`).toBe(true);
      expect(["light", "dark"]).toContain(t.mode);
      expect(["rounded", "pill", "square"]).toContain(t.buttonStyle);
      expect(["soft", "sharp", "round"]).toContain(t.radiusScale);
      expect(["plain", "tinted"]).toContain(t.background);
      expect(["normal", "caps"]).toContain(t.headingStyle);
      expect(typeof t.gradient).toBe("boolean");
      expect(t.delatnosti.length, t.id).toBeGreaterThan(0);
    }
  });

  it("svaka delatnost ima dovoljno velik pul (svoje + univerzalne teme)", () => {
    const delatnosti: Delatnost[] = ["frizerski", "barbershop", "kozmetika", "masaza"];
    for (const d of delatnosti) {
      const pul = SITE_THEMES.filter(
        (t) => t.delatnosti.includes(d) || t.delatnosti.includes("univerzalno")
      );
      expect(pul.length, d).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("prepoznajDelatnost", () => {
  it("prepoznaje delatnost iz naziva usluga", () => {
    expect(prepoznajDelatnost(["Oblikovanje brade", "Fade", "Brijanje"])).toBe("barbershop");
    expect(prepoznajDelatnost(["Žensko šišanje", "Farbanje", "Feniranje"])).toBe("frizerski");
    expect(prepoznajDelatnost(["Gel nokti", "Manikir", "Laminacija obrva"])).toBe("kozmetika");
    expect(prepoznajDelatnost(["Relax masaža", "Aromaterapija"])).toBe("masaza");
  });

  it("bez prepoznatljivih usluga vraća univerzalno", () => {
    expect(prepoznajDelatnost([])).toBe("univerzalno");
    expect(prepoznajDelatnost(["Konsultacije", "Termin"])).toBe("univerzalno");
  });

  it("svaka delatnost ima labelu za prikaz u koracima", () => {
    for (const kljuc of Object.keys(DELATNOST_LABELS)) {
      expect(DELATNOST_LABELS[kljuc as Delatnost].length).toBeGreaterThan(2);
    }
  });
});

describe("predloziTemu", () => {
  it("bira iz pula delatnosti ili univerzalnih", () => {
    for (let i = 0; i < 30; i++) {
      const { tema, delatnost } = predloziTemu(["Oblikovanje brade", "Brijanje"]);
      expect(delatnost).toBe("barbershop");
      expect(
        tema.delatnosti.includes("barbershop") || tema.delatnosti.includes("univerzalno")
      ).toBe(true);
    }
  });

  it("'Probaj drugi' ne vraća upravo prikazanu temu", () => {
    const prva = predloziTemu(["Relax masaža"]).tema;
    for (let i = 0; i < 30; i++) {
      expect(predloziTemu(["Relax masaža"], prva.id).tema.id).not.toBe(prva.id);
    }
  });
});
