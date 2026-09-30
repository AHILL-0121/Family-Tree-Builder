import { describe, expect, it } from "vitest";
import { crc32, pngWithDpi } from "./png";

describe("pngWithDpi", () => {
  // signature + a 1×1 IHDR + IEND (contents beyond IHDR don't matter here)
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89,
    0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  it("computes PNG CRCs", () => {
    expect(crc32(png.subarray(12, 29))).toBe(0x1f15c489); // the IHDR's own CRC
    expect(crc32(png.subarray(37, 41))).toBe(0xae426082); // IEND
  });

  it("inserts a pHYs chunk after IHDR with the dpi in pixels per metre", () => {
    const out = pngWithDpi(png, 300);
    expect(out.length).toBe(png.length + 21);
    const v = new DataView(out.buffer);
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe("pHYs");
    expect(v.getUint32(41)).toBe(11811);
    expect(v.getUint32(45)).toBe(11811);
    expect(out[49]).toBe(1);
    expect(v.getUint32(50)).toBe(crc32(out.subarray(37, 50)));
    expect(String.fromCharCode(...out.subarray(58, 62))).toBe("IEND");
  });
});
