import { describe, expect, it } from "vitest";
import { fitName } from "./name-fit";

// Stand-in font: every character is half the font size wide
const measure = (s: string, px: number) => s.length * px * 0.5;

describe("fitName", () => {
  it("keeps a name that fits at full size", () => {
    expect(fitName("Selvaraj", 116, measure)).toEqual({ size: 15.5, lines: ["Selvaraj"] });
  });

  it("shrinks before wrapping", () => {
    // 16 chars: 124px at 15.5, 116px at 14.5
    expect(fitName("Shanmugasundaram", 116, measure)).toEqual({ size: 14.5, lines: ["Shanmugasundaram"] });
  });

  it("wraps two words when 13px is still too wide", () => {
    // 20 chars: 130px at 13
    expect(fitName("Kaalianna Gounderrrr", 116, measure)).toEqual({ size: 15.5, lines: ["Kaalianna", "Gounderrrr"] });
  });

  it("splits longer names where the lines are most even", () => {
    const fit = fitName("Arul Mozhi Varman Rajendran", 116, measure);
    expect(fit.lines).toEqual(["Arul Mozhi", "Varman Rajendran"]);
    expect(fit.size).toBe(14.5);
  });

  it("leaves a single long word on one line at the smallest size", () => {
    expect(fitName("Venkatasubramaniam", 100, measure)).toEqual({ size: 13, lines: ["Venkatasubramaniam"] });
  });
});
