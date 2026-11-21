import { describe, expect, it } from "vitest";
import { formatDate, formatDateWithYear, formatYen, parseYenInput } from "./format";

describe("formatYen", () => {
  it("整数円を整形する", () => {
    expect(formatYen(12345)).toBe("￥12,345");
    expect(formatYen(0)).toBe("￥0");
  });
  it("null/undefined はプレースホルダ", () => {
    expect(formatYen(null)).toBe("—");
    expect(formatYen(undefined)).toBe("—");
  });
});

describe("parseYenInput", () => {
  it("非負整数を受理する", () => {
    expect(parseYenInput("12000")).toBe(12000);
    expect(parseYenInput("12,000")).toBe(12000);
    expect(parseYenInput("")).toBeNull();
  });
  it("小数・負数・非数を拒否する", () => {
    expect(Number.isNaN(parseYenInput("1.5"))).toBe(true);
    expect(Number.isNaN(parseYenInput("-5"))).toBe(true);
    expect(Number.isNaN(parseYenInput("abc"))).toBe(true);
  });
});

describe("dates", () => {
  it("YYYY-MM-DD を整形する", () => {
    expect(formatDate("2026-01-10")).toBe("1/10");
    expect(formatDateWithYear("2026-01-10")).toBe("2026/1/10");
    expect(formatDate(null)).toBe("—");
  });
});
