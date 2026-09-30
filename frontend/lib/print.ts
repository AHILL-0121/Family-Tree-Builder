// Vector PDF through the browser's own print pipeline: the poster SVG sits alone on a page
// sized exactly to the paper, and "Save as PDF" keeps every shape and letter as vectors with
// the fonts embedded. The browser shapes Tamil itself, which no in-page PDF library does well.

/** Standalone HTML page that prints one SVG edge to edge. Size in millimetres. */
export function printablePosterHTML(svg: string, page: { w: number; h: number }, title: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const size = `${page.w}mm ${page.h}mm`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { size: ${size}; margin: 0; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
svg { display: block; width: ${page.w}mm; height: ${page.h}mm; page-break-inside: avoid; break-inside: avoid; }
</style></head><body>${svg}</body></html>`;
}

/** Opens the print dialog for the page in a hidden frame; resolves once the dialog closes. */
export async function printHTML(html: string): Promise<void> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  const loaded = new Promise<void>((r) => frame.addEventListener("load", () => r(), { once: true }));
  frame.srcdoc = html;
  document.body.appendChild(frame);
  try {
    await loaded;
    const win = frame.contentWindow!;
    await win.document.fonts.ready; // embedded fonts must be in before the page is laid out
    win.focus();
    win.print(); // blocks until the dialog closes in Chrome, Edge and Firefox
  } finally {
    // Safari returns from print() early; give its dialog time to take the page
    setTimeout(() => frame.remove(), 60_000);
  }
}
