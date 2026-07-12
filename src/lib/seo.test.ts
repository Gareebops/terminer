import { describe, expect, it } from "vitest";
import { jsonLdString, salonCanonicalBase, SITE_URL } from "./seo";

describe("jsonLdString", () => {
  it("serijalizuje običan objekat", () => {
    expect(jsonLdString({ a: 1, b: "dva" })).toBe('{"a":1,"b":"dva"}');
  });

  it("escape-uje </script> proboj iz korisničkog sadržaja", () => {
    const out = jsonLdString({ name: '</script><img src=x onerror="1">' });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("\\u003c/script\\u003e");
    // Escape mora ostati validan JSON sa istim sadržajem
    expect(JSON.parse(out)).toEqual({
      name: '</script><img src=x onerror="1">',
    });
  });

  it("escape-uje ampersand (HTML entiteti ne smeju da se tumače)", () => {
    const out = jsonLdString({ name: "Šišanje & feniranje" });
    expect(out).not.toContain("&");
    expect(JSON.parse(out)).toEqual({ name: "Šišanje & feniranje" });
  });
});

describe("salonCanonicalBase", () => {
  it("bez custom domena vraća platformsku putanju", () => {
    expect(salonCanonicalBase({ slug: "demo", custom_domain: null })).toBe(
      `${SITE_URL}/demo`
    );
  });

  it("custom domen je kanonski kad postoji", () => {
    expect(
      salonCanonicalBase({ slug: "demo", custom_domain: "mojsalon.rs" })
    ).toBe("https://mojsalon.rs");
  });

  it("podnosi i red bez custom_domain kolone (undefined)", () => {
    expect(salonCanonicalBase({ slug: "demo" })).toBe(`${SITE_URL}/demo`);
  });
});
