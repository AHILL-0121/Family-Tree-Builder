import { describe, expect, it } from "vitest";
import { imagePdf, unitsToPt } from "./pdf";

async function bytes(b: Blob) {
  return new Uint8Array(await b.arrayBuffer());
}
const latin1 = (u: Uint8Array) => Array.from(u, (c) => String.fromCharCode(c)).join("");

describe("imagePdf", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

  it("writes a well-formed single-page PDF with a correct xref table", async () => {
    const raw = latin1(await bytes(imagePdf({ jpeg, width: 3, height: 2 }, { w: 841.89, h: 595.28 }, "அருள்மொழி family")));
    expect(raw.startsWith("%PDF-1.4\n")).toBe(true);
    expect(raw.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(raw).toContain("/MediaBox [0 0 841.89 595.28]");
    expect(raw).toContain("/Width 3 /Height 2");
    expect(raw).toContain(`/Length ${jpeg.length}`);

    // startxref points at the xref table, and every entry points at its object
    const xref = Number(/startxref\n(\d+)/.exec(raw)![1]);
    expect(raw.slice(xref, xref + 4)).toBe("xref");
    const entries = raw.slice(xref).split("\n").slice(3, 9);
    entries.forEach((e, i) => {
      const off = Number(e.slice(0, 10));
      expect(raw.slice(off, off + 8)).toBe(`${i + 1} 0 obj\n`);
    });
  });

  it("converts A4 poster units to points", () => {
    expect(unitsToPt(1188)).toBeCloseTo(841.89, 1);
    expect(unitsToPt(840)).toBeCloseTo(595.28, 1);
  });
});
