import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("domaći formati se svode na isti kanonski +381 broj", () => {
    expect(normalizePhone("060 123 456")).toBe("+38160123456");
    expect(normalizePhone("060/123-456")).toBe("+38160123456");
    expect(normalizePhone("0601234567")).toBe("+381601234567");
  });

  it("međunarodni oblici ostaju/postaju +381", () => {
    expect(normalizePhone("+381 60 123 456")).toBe("+38160123456");
    expect(normalizePhone("0038160123456")).toBe("+38160123456");
    // prepisan međunarodni format bez plusa
    expect(normalizePhone("38160123456")).toBe("+38160123456");
  });

  it("strani broj zadržava svoj prefiks", () => {
    expect(normalizePhone("+49 170 1234567")).toBe("+491701234567");
    expect(normalizePhone("00385911234567")).toBe("+385911234567");
  });

  it("plus sme samo na početku, ostali se čiste", () => {
    expect(normalizePhone("+381+60+123456")).toBe("+38160123456");
    expect(normalizePhone("060+123456")).toBe("+38160123456");
  });
});
