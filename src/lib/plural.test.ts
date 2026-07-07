import { describe, expect, it } from "vitest";
import { plural } from "./plural";

const TERMIN: [string, string, string] = ["termin", "termina", "termina"];
const DAN: [string, string, string] = ["dan", "dana", "dana"];

describe("plural (srpska množina)", () => {
  it("jednina za 1 i 21, 31... ali NE za 11", () => {
    expect(plural(1, TERMIN)).toBe("termin");
    expect(plural(21, DAN)).toBe("dan");
    expect(plural(101, TERMIN)).toBe("termin");
    expect(plural(11, TERMIN)).toBe("termina");
    expect(plural(111, DAN)).toBe("dana");
  });

  it("paukal za 2-4 i 22-24, ali NE za 12-14", () => {
    expect(plural(2, TERMIN)).toBe("termina");
    expect(plural(4, DAN)).toBe("dana");
    expect(plural(24, TERMIN)).toBe("termina");
    expect(plural(12, TERMIN)).toBe("termina");
    expect(plural(14, DAN)).toBe("dana");
  });

  it("množina za 0, 5+ i 11-14", () => {
    expect(plural(0, TERMIN)).toBe("termina");
    expect(plural(5, TERMIN)).toBe("termina");
    expect(plural(13, DAN)).toBe("dana");
    expect(plural(100, DAN)).toBe("dana");
  });
});
