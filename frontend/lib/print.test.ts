import { describe, expect, it } from "vitest";
import { printablePosterHTML } from "./print";

describe("printablePosterHTML", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1188 840" width="1188" height="840"><text>அருள்</text></svg>`;

  it("sizes the page and the poster to the paper with no margin", () => {
    const html = printablePosterHTML(svg, { w: 297, h: 210 }, "RK FAM");
    expect(html).toContain("@page { size: 297mm 210mm; margin: 0; }");
    expect(html).toContain("width: 297mm; height: 210mm;");
    expect(html).toContain("print-color-adjust: exact");
    expect(html).toContain(svg);
  });

  it("escapes the title", () => {
    expect(printablePosterHTML(svg, { w: 1, h: 1 }, "<b>&</b>")).toContain("<title>&lt;b>&amp;&lt;/b></title>");
  });
});
