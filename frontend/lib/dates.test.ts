import { describe, expect, it } from "vitest";
import { compareDates, formatDate, parseDateInput } from "./dates";

const ok = (s: string, opts?: { future?: boolean }) => {
  const r = parseDateInput(s, opts);
  if (!r.ok) throw new Error(`expected ${s} to parse: ${r.error}`);
  return r.value;
};
const fails = (s: string) => expect(parseDateInput(s).ok).toBe(false);

describe("parseDateInput", () => {
  it("accepts a year alone", () => {
    expect(ok("1962")).toBe("1962");
    expect(ok("  1962 ")).toBe("1962");
    expect(ok("")).toBe("");
  });

  it("accepts approximate years", () => {
    expect(ok("c. 1936")).toBe("c. 1936");
    expect(ok("c1936")).toBe("c. 1936");
    expect(ok("circa 1936")).toBe("c. 1936");
  });

  it("accepts DD-MM-YYYY with any common separator and stores ISO", () => {
    expect(ok("12-04-1962")).toBe("1962-04-12");
    expect(ok("12/04/1962")).toBe("1962-04-12");
    expect(ok("5.3.1962")).toBe("1962-03-05");
    expect(ok("29-02-2000")).toBe("2000-02-29");
  });

  it("still reads ISO dates from older saves", () => {
    expect(ok("1962-04-12")).toBe("1962-04-12");
  });

  it("rejects impossible, future and unrecognised dates", () => {
    fails("31-02-1962");
    fails("29-02-1900");
    fails("12-13-1962");
    fails("April 1962");
    fails("62");
    fails(`01-01-${new Date().getFullYear() + 1}`);
    fails(String(new Date().getFullYear() + 1));
    expect(ok(String(new Date().getFullYear() + 1), { future: true })).toBe(String(new Date().getFullYear() + 1));
  });
});

describe("formatDate", () => {
  it("shows stored ISO as DD-MM-YYYY and leaves the rest alone", () => {
    expect(formatDate("1962-04-12")).toBe("12-04-1962");
    expect(formatDate("1962")).toBe("1962");
    expect(formatDate("c. 1936")).toBe("c. 1936");
    expect(formatDate(undefined)).toBe("");
  });
});

describe("compareDates", () => {
  it("orders by year, then by full date when both have one", () => {
    expect(compareDates("1960", "1962")!).toBeLessThan(0);
    expect(compareDates("1962-01-05", "1962-11-20")!).toBeLessThan(0);
    expect(compareDates("1962-11-20", "1962-01-05")!).toBeGreaterThan(0);
  });

  it("can't tell when a year is shared and one side is only a year, or a date is missing", () => {
    expect(compareDates("1962", "1962-04-12")).toBeNull();
    expect(compareDates("1962", "1962")).toBeNull();
    expect(compareDates("", "1962")).toBeNull();
  });
});
