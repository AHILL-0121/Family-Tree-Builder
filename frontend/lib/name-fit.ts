// Fitting a person's name into the fixed-width canvas card:
//   1. the full name at 15.5px if it fits;
//   2. otherwise the largest size down to 13px at which it fits on one line;
//   3. otherwise, for names of two or more words, two lines (split where the lines are most
//      even), at the largest size down to 13px that fits.
// If none of that fits (one very long word) the name stays on one line at 13px.

export const NAME_SIZES = [15.5, 15, 14.5, 14, 13.5, 13];

export interface NameFit {
  size: number;
  lines: string[];
}

/** `measure(text, px)` returns the rendered width in px. */
export function fitName(name: string, maxWidth: number, measure: (text: string, px: number) => number): NameFit {
  for (const size of NAME_SIZES) {
    if (measure(name, size) <= maxWidth) return { size, lines: [name] };
  }
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return { size: NAME_SIZES[NAME_SIZES.length - 1], lines: [name] };

  // Most even split: smallest widest line
  let best: string[] = [], bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const w = Math.max(...lines.map((l) => measure(l, NAME_SIZES[0])));
    if (w < bestW) { best = lines; bestW = w; }
  }
  for (const size of NAME_SIZES) {
    if (best.every((l) => measure(l, size) <= maxWidth)) return { size, lines: best };
  }
  return { size: NAME_SIZES[NAME_SIZES.length - 1], lines: best };
}
