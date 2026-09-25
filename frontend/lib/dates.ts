// Life-event dates. People type a year ("1962"), an approximate year ("c. 1936") or a full
// date as DD-MM-YYYY ("12-04-1962"). Full dates are stored as ISO (YYYY-MM-DD) so a backup
// file is unambiguous; forms and details always show them back as DD-MM-YYYY. The canvas and
// poster only ever show the year (see yearOf in person-display).

export type DateResult = { ok: true; value: string } | { ok: false; error: string };

export const DATE_HINT = "A year (1962) or the full date (12-04-1962). Use “c. 1936” when unsure.";
export const DATE_PLACEHOLDER = "1962 or 12-04-1962";

const pad = (n: number) => String(n).padStart(2, "0");
const isRealDate = (y: number, m: number, d: number) => {
  if (m < 1 || m > 12 || d < 1) return false;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= days;
};

/** Parse what someone typed. Empty is fine (unknown). `future` allows dates after today. */
export function parseDateInput(raw: string, { future = false } = {}): DateResult {
  const s = raw.trim();
  if (!s) return { ok: true, value: "" };
  const now = new Date();
  const thisYear = now.getFullYear();
  const bad = (error: string): DateResult => ({ ok: false, error });

  // "1962"  ·  "c. 1936" / "c 1936" / "ca. 1936" / "circa 1936"
  const year = /^(?:(c|ca|circa)\.?\s*)?(\d{4})$/i.exec(s);
  if (year) {
    const y = Number(year[2]);
    if (y < 1000) return bad("That year looks too early.");
    if (!future && y > thisYear) return bad("That year is in the future.");
    return { ok: true, value: year[1] ? `c. ${y}` : String(y) };
  }

  // DD-MM-YYYY with - / . separators; YYYY-MM-DD accepted too (older saves)
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (dmy || ymd) {
    const [d, m, y] = dmy ? [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])] : [Number(ymd![3]), Number(ymd![2]), Number(ymd![1])];
    if (!isRealDate(y, m, d)) return bad(`There's no ${pad(d)}-${pad(m)}-${y}. Use DD-MM-YYYY.`);
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const today = `${thisYear}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (!future && iso > today) return bad("That date is in the future.");
    return { ok: true, value: iso };
  }

  return bad("Use a year (1962) or a full date as DD-MM-YYYY (12-04-1962).");
}

/** Stored value → what the form and details panel show. Anything unrecognised is shown as is. */
export function formatDate(stored: string | null | undefined): string {
  const s = String(stored ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : s;
}

/**
 * Order two stored dates: negative if a is earlier. null when it can't be told: either is
 * missing, or they share a year and at least one is only a year.
 */
export function compareDates(a: string | null | undefined, b: string | null | undefined): number | null {
  const key = (s: string | null | undefined) => {
    const v = String(s ?? "");
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (iso) return { y: Number(iso[1]), md: Number(iso[2]) * 100 + Number(iso[3]) };
    const y = /\d{4}/.exec(v);
    return y ? { y: Number(y[0]), md: null } : null;
  };
  const ka = key(a), kb = key(b);
  if (!ka || !kb) return null;
  if (ka.y !== kb.y) return ka.y - kb.y;
  if (ka.md == null || kb.md == null) return null;
  return ka.md - kb.md;
}
