import type { PosterFonts } from "./poster";

// Exported SVG/PNG files can't see the page's CSS, so the fonts next/font serves are copied
// into the file: find their @font-face rules, fetch each font file, inline it as a data URL.
// Without this, exports silently fall back to system fonts (audit V-12).

const VARS: Record<keyof PosterFonts, string> = { serif: "--font-serif", mono: "--font-geist-mono", tamil: "--font-tamil" };
const FALLBACK: PosterFonts = { serif: "Georgia, serif", mono: "ui-monospace, monospace", tamil: "Latha, serif" };

let cache: Promise<{ css: string; fonts: PosterFonts }> | null = null;

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

export function embeddedPosterFonts(): Promise<{ css: string; fonts: PosterFonts }> {
  cache ??= build().catch((e) => { cache = null; throw e; });
  return cache;
}

async function build() {
  const root = getComputedStyle(document.documentElement);
  const fonts = {} as PosterFonts;
  const wanted = new Set<string>();
  (Object.keys(VARS) as (keyof PosterFonts)[]).forEach((k) => {
    const value = root.getPropertyValue(VARS[k]).trim();
    fonts[k] = value ? `${value}, ${FALLBACK[k]}` : FALLBACK[k];
    value.split(",").forEach((f) => wanted.add(f.trim().replace(/^['"]|['"]$/g, "")));
  });

  const rules: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try { list = sheet.cssRules; } catch { continue; } // cross-origin sheet
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSFontFaceRule && wanted.has(rule.style.getPropertyValue("font-family").trim().replace(/^['"]|['"]$/g, ""))) rules.push(rule);
    }
  }

  const parts = await Promise.all(
    rules.map(async (rule) => {
      let text = rule.cssText;
      const urls = Array.from(text.matchAll(/url\(["']?([^"')]+)["']?\)/g)).map((m) => m[1]);
      for (const url of urls) {
        const abs = new URL(url, (rule.parentStyleSheet?.href ?? location.href)).href;
        const data = await toDataUrl(await (await fetch(abs)).blob());
        text = text.split(url).join(data);
      }
      return text;
    })
  );
  return { css: parts.join("\n"), fonts };
}
