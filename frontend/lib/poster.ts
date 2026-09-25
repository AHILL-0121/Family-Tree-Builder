import { Person, getFullName } from "./types";
import { findRelationship } from "./relationships";
import { layoutFamily, NODE_W } from "./layout";

// Poster export (replaces the old Topola "Fancy" view). Pure string builder: no DOM, so it
// is unit-testable and the same code renders the preview, the SVG/PNG download and print.
// Visual reference: plan/sampleUI.html → Export. Design notes: plan/design.md §5.8a.

export type PosterStyle = "register" | "illus";
export type PosterInclude = "whole" | "desc" | "anc";
export type PosterLabels = "names" | "tamil" | "both";
export type PaperSize = "a4" | "a3" | "a2" | "phone";
export type Foliage = "light" | "lush" | "autumn";

export interface PosterOptions {
  title: string;
  style: PosterStyle;
  include: PosterInclude;
  focus: string | null; // person for descendants / ancestors
  rootId: string | null; // top of the branch for "whole" (illustrated needs one trunk)
  dir: "top" | "bottom"; // where the oldest generation goes (register only)
  labels: PosterLabels;
  anchor: string | null; // "relations as seen by"
  size: PaperSize;
  orient: "landscape" | "portrait";
  foliage: Foliage;
}

export interface PosterFonts {
  serif: string;
  mono: string;
  tamil: string;
}

export interface PosterView {
  interactive?: boolean; // preview: hover/click targets
  animate?: boolean; // preview: grow-in classes
  fonts?: PosterFonts; // resolved families for standalone exports (the preview inherits CSS vars)
}

const PREVIEW_FONTS: PosterFonts = {
  serif: "var(--font-serif, Newsreader), Georgia, serif",
  mono: "var(--font-geist-mono, 'Geist Mono'), ui-monospace, monospace",
  tamil: "var(--font-tamil, 'Noto Serif Tamil'), Latha, serif",
};

export const PAPER: Record<PaperSize, { w: number; h: number; f: number; name: string }> = {
  a4: { w: 1188, h: 840, f: 2.953, name: "A4" }, // 4 units per mm; f = multiplier to 300 dpi
  a3: { w: 1680, h: 1188, f: 2.953, name: "A3" },
  a2: { w: 2376, h: 1680, f: 1.969, name: "A2" }, // 200 dpi keeps the canvas a sane size
  phone: { w: 645, h: 1398, f: 2, name: "phone" },
};

const PAL = {
  register: { paper: "#FBF9F4", ink: "#1B1A17", ink2: "#57534A", ink3: "#8A8579", rule: "#DDD7CA", card: "#FFFFFF", portrait: "#ECE6D9", accent: "#B3432A", line: "#A39C8C" },
  illus: { paper: "#F3EAD7", ink: "#3B3024", ink2: "#6B5A45", ink3: "#8E7C64", rule: "#CDBE9F", card: "#FAF4E6", portrait: "#EADFC6", accent: "#9C4A2C", line: "#5B4530" },
};
type Palette = (typeof PAL)["register"];

const FOLIAGE: Record<Foliage, { leaves: string[]; canopy: string[] | null; twigs: number; along: number; edge: number }> = {
  light: { leaves: ["#5F7040", "#788A4A", "#8E9B57"], canopy: null, twigs: 1, along: 3, edge: 0 },
  lush: { leaves: ["#56683A", "#6B7D43", "#839452"], canopy: ["#A9B87A", "#93A566", "#BFCB95"], twigs: 1, along: 1, edge: 7 },
  autumn: { leaves: ["#B5652E", "#C98A3A", "#9E4B2A", "#D2A24C"], canopy: ["#E0B56E", "#D19550", "#EACB95"], twigs: 1, along: 1, edge: 7 },
};

const SLOT = 116, R1 = 41, R2 = 48;
const W = NODE_W;

// ---------- helpers ----------
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const f1 = (v: number) => v.toFixed(1);
const yearOf = (s: string | undefined | null) => { const m = String(s ?? "").match(/\d{4}/); return m ? Number(m[0]) : null; };
function yearsLabel(p: Person) {
  const b = yearOf(p.birth?.date), d = yearOf(p.death?.date);
  if (d) return `${b ?? "?"} – ${d}`;
  if (b) return `b. ${b}`;
  return p.death ? "deceased" : "";
}
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
function initial(p: Person) {
  const s = (p.givenName || p.surname || getFullName(p) || "?").trim();
  if (segmenter) for (const { segment } of segmenter.segment(s)) return segment.toUpperCase();
  return Array.from(s)[0]?.toUpperCase() ?? "?";
}
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const bez = (p0: number, p1: number, p2: number, p3: number, t: number) => { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; };
const bezD = (p0: number, p1: number, p2: number, p3: number, t: number) => { const u = 1 - t; return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2); };
type Pt = { x: number; y: number };

export function paperDims(o: Pick<PosterOptions, "size" | "orient">) {
  const p = PAPER[o.size];
  if (o.size === "phone") return { w: p.w, h: p.h, f: p.f };
  return o.orient === "portrait" ? { w: p.h, h: p.w, f: p.f } : { w: p.w, h: p.h, f: p.f };
}

// Largest family tree's top person: the natural trunk for "whole branch"
export function mainRoot(people: Person[]): string | null {
  const byId = new Map(people.map((p) => [p.id, p]));
  const kids = new Map<string, string[]>(people.map((p) => [p.id, []]));
  for (const p of people) for (const pid of p.parentIds) kids.get(pid)?.push(p.id);
  const hasParents = (p: Person) => p.parentIds.some((id) => byId.has(id));
  const size = (id: string, seen = new Set<string>()): number => { if (seen.has(id)) return 0; seen.add(id); return 1 + (kids.get(id) ?? []).reduce((a, k) => a + size(k, seen), 0); };
  const roots = people.filter((p) => !hasParents(p) && !p.spouseIds.some((s) => byId.has(s) && hasParents(byId.get(s)!)));
  roots.sort((a, b) => size(b.id) - size(a.id));
  return roots[0]?.id ?? people[0]?.id ?? null;
}

function labelFor(people: Person[], byId: Map<string, Person>, o: PosterOptions, id: string): { en: string; ta: string } | null {
  if (o.labels === "names" || !o.anchor || !byId.has(o.anchor)) return null;
  if (id === o.anchor) return { en: o.labels === "both" ? "me" : "", ta: "நான்" };
  const r = findRelationship(people, byId.get(o.anchor)!, byId.get(id)!);
  if (!r.related) return null;
  return { en: o.labels === "both" ? r.english : "", ta: r.tamil };
}

// ---------- Illustrated: a grown tree ----------
interface GNode { id: string; members: string[]; depth: number; parent: GNode | null; kids: GNode[]; x: number; w: number; kw: number; cx: number; cy: number; wt?: number; bey?: string[] }

function growthTree(people: Person[], byId: Map<string, Person>, o: PosterOptions): GNode | null {
  const anc = o.include === "anc", seen = new Set<string>();
  const rootId = o.include === "whole" ? o.rootId ?? mainRoot(people) : o.focus;
  if (!rootId || !byId.has(rootId)) return null;
  const kidsOf = new Map<string, string[]>(people.map((p) => [p.id, []]));
  for (const p of people) for (const pid of p.parentIds) kidsOf.get(pid)?.push(p.id);
  const born = (id: string) => yearOf(byId.get(id)?.birth?.date) ?? 9999;
  function build(id: string, depth: number, parent: GNode | null): GNode {
    seen.add(id);
    let members = [id];
    if (!anc) { const sp = byId.get(id)!.spouseIds.filter((s) => byId.has(s) && !seen.has(s)); sp.forEach((s) => seen.add(s)); members = [id, ...sp]; }
    const next = anc ? byId.get(id)!.parentIds.filter((q) => byId.has(q)) : [...(kidsOf.get(id) ?? [])].sort((a, b) => born(a) - born(b));
    const g: GNode = { id, members, depth, parent, kids: [], x: 0, w: 0, kw: 0, cx: 0, cy: 0 };
    next.forEach((k) => { if (!seen.has(k)) g.kids.push(build(k, depth + 1, g)); });
    return g;
  }
  return build(rootId, 0, null);
}

function illusTree(people: Person[], byId: Map<string, Person>, o: PosterOptions, c: Palette, view: PosterView, areaAspect: number) {
  const root = growthTree(people, byId, o);
  if (!root) return null;
  const fol = FOLIAGE[o.foliage] ?? FOLIAGE.lush, lab = o.labels !== "names";
  const wood = c.line, barkDark = "#3A2B1D", barkLight = "#8C6F50";
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x: number, y: number, pad = 0) => { minX = Math.min(minX, x - pad); maxX = Math.max(maxX, x + pad); minY = Math.min(minY, y - pad); maxY = Math.max(maxY, y + pad); };
  const walk = (g: GNode, fn: (g: GNode) => void) => { fn(g); g.kids.forEach((k) => walk(k, fn)); };
  const rad = (g: GNode) => (g.members.length > 1 ? R2 : R1);
  const P = (id: string) => byId.get(id)!;

  // layout: tidy tree of units, one line per generation, row height fitted to the page
  const measure = (g: GNode) => { g.kids.forEach(measure); g.kw = g.kids.reduce((a, k) => a + k.w, 0); g.w = Math.max(SLOT, g.kw); };
  const place = (g: GNode, left: number) => {
    if (!g.kids.length) { g.x = left + g.w / 2; return; }
    let x = left + (g.w - g.kw) / 2;
    g.kids.forEach((k) => { place(k, x); x += k.w; });
    g.x = (g.kids[0].x + g.kids[g.kids.length - 1].x) / 2;
  };
  let maxDepth = 0; walk(root, (g) => { maxDepth = Math.max(maxDepth, g.depth); });
  measure(root);
  const rowH = clamp((root.w / areaAspect - SLOT * 1.6) / (maxDepth + 0.95), 150, 330);
  place(root, 0);
  const spread = new Array(maxDepth + 1).fill(0);
  walk(root, (g) => g.kids.forEach((k) => { spread[g.depth] = Math.max(spread[g.depth], Math.abs(k.x - g.x)); }));
  const rowY = [0];
  for (let d = 0; d < maxDepth; d++) rowY.push(rowY[d] - clamp(spread[d] * 0.5, rowH, rowH * 1.9));
  walk(root, (g) => { g.cx = g.x; g.cy = rowY[g.depth]; });

  const weight = (g: GNode): number => (g.wt ??= g.members.length + g.kids.reduce((a, k) => a + weight(k), 0));
  const beyond = (g: GNode): string[] => (g.bey ??= [...g.members, ...g.kids.flatMap(beyond)]);
  const wid = (wt: number) => 2.6 + 4.1 * Math.sqrt(wt);

  function taper(p: Pt[], w0: number, w1: number, N = 26) {
    const L: number[][] = [], R: number[][] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = bez(p[0].x, p[1].x, p[2].x, p[3].x, t), y = bez(p[0].y, p[1].y, p[2].y, p[3].y, t);
      const dx = bezD(p[0].x, p[1].x, p[2].x, p[3].x, t), dy = bezD(p[0].y, p[1].y, p[2].y, p[3].y, t), len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, w = (w0 + (w1 - w0) * Math.pow(t, 0.75)) / 2;
      L.push([x + nx * w, y + ny * w]); R.push([x - nx * w, y - ny * w]); grow(x, y, w);
    }
    return "M" + L.concat(R.reverse()).map((q) => f1(q[0]) + " " + f1(q[1])).join("L") + "Z";
  }
  function along(p: Pt[], w0: number, w1: number, k: number, from = 0.05, to = 0.95) {
    const out: string[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = from + (to - from) * i / 20, x = bez(p[0].x, p[1].x, p[2].x, p[3].x, t), y = bez(p[0].y, p[1].y, p[2].y, p[3].y, t);
      const dx = bezD(p[0].x, p[1].x, p[2].x, p[3].x, t), dy = bezD(p[0].y, p[1].y, p[2].y, p[3].y, t), len = Math.hypot(dx, dy) || 1;
      const w = (w0 + (w1 - w0) * Math.pow(t, 0.75)) / 2;
      out.push(f1(x - dy / len * w * k) + " " + f1(y + dx / len * w * k));
    }
    return "M" + out.join("L");
  }
  const bark = (p: Pt[], w0: number, w1: number) => w0 < 8 ? "" :
    `<path d="${along(p, w0, w1, -0.42)}" fill="none" stroke="${barkLight}" stroke-opacity=".38" stroke-width="${f1(Math.max(1, w0 * 0.12))}" stroke-linecap="round"/>` +
    `<path d="${along(p, w0, w1, 0.3, 0.08, 0.8)}" fill="none" stroke="${barkDark}" stroke-opacity=".3" stroke-width=".9" stroke-dasharray="16 7 28 9"/>` +
    (w0 > 13 ? `<path d="${along(p, w0, w1, -0.05, 0.1, 0.7)}" fill="none" stroke="${barkDark}" stroke-opacity=".2" stroke-width=".8" stroke-dasharray="9 12 20 6"/>` : "");
  const leaf = (x: number, y: number, deg: number, s: number, rnd: () => number) => { grow(x, y, 18 * s); return `<use href="#lf" fill="${fol.leaves[Math.floor(rnd() * fol.leaves.length)]}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(deg)}) scale(${s.toFixed(2)})"/>`; };
  const cluster = (x: number, y: number, n: number, baseDeg: number, spreadDeg: number, rnd: () => number) => {
    let h = "";
    for (let i = 0; i < n; i++) { const a = baseDeg + (rnd() - 0.5) * spreadDeg, r = 3 + rnd() * 9; h += leaf(x + Math.cos(a * Math.PI / 180) * r, y + Math.sin(a * Math.PI / 180) * r, a + (rnd() - 0.5) * 30, 0.75 + rnd() * 0.6, rnd); }
    return h;
  };
  const anim = (cls: string, d: number) => (view.animate ? ` class="${cls} ${cls === "wood" ? "grow-w" : "grow-l"}" style="--d:${(d * 0.26).toFixed(2)}s"` : ` class="${cls}"`);

  let canopy = "", ground = "", woodSVG = "", leafSVG = "", meds = "";

  // canopy: merged silhouettes behind the crown; none on the trunk
  const onTrunk = new Set<GNode>();
  for (let g: GNode | null = root; g; g = g.kids.length === 1 ? g.kids[0] : null) { onTrunk.add(g); if (g.kids.length !== 1) break; }
  if (fol.canopy) {
    let shade = "", body = "", light = "", edge = "";
    const circ = (x: number, y: number, r: number) => { grow(x, y, r); return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/>`; };
    walk(root, (g) => {
      if (onTrunk.has(g)) return;
      const rnd = rng("puff" + g.id), r = SLOT * (0.7 + rnd() * 0.08), jx = (rnd() - 0.5) * 12;
      shade += circ(g.cx + jx, g.cy + 12, r * 0.98) + circ(g.cx - SLOT * 0.38, g.cy + SLOT * 0.2, r * 0.7) + circ(g.cx + SLOT * 0.38, g.cy + SLOT * 0.2, r * 0.7);
      body += circ(g.cx + jx, g.cy - 6, r) + circ(g.cx - SLOT * 0.4, g.cy + SLOT * 0.08, r * 0.72) + circ(g.cx + SLOT * 0.4, g.cy + SLOT * 0.06, r * 0.72);
      light += circ(g.cx - r * 0.3 + jx, g.cy - r * 0.42, r * 0.46);
      if (g.parent && !onTrunk.has(g.parent) && Math.hypot(g.cx - g.parent.cx, g.cy - g.parent.cy) < SLOT * 2.4) body += circ((g.cx + g.parent.cx) / 2, (g.cy + g.parent.cy) / 2, SLOT * 0.55);
      for (let i = 0; i < fol.edge; i++) { const a = (-168 + rnd() * 156) * Math.PI / 180; edge += leaf(g.cx + jx + Math.cos(a) * r * 0.97, g.cy - 6 + Math.sin(a) * r * 0.97, a * 180 / Math.PI + (rnd() - 0.5) * 40, 0.85 + rnd() * 0.6, rnd); }
    });
    canopy = `<g${anim("canopy", 1)}><g fill="${fol.canopy[1]}" opacity=".5">${shade}</g><g fill="${fol.canopy[0]}" opacity=".62">${body}</g><g fill="${fol.canopy[2]}" opacity=".55">${light}</g>${edge}</g>`;
  }

  // trunk, roots and ground
  {
    const rnd = rng("trunk" + root.id), wt = wid(weight(root)) * 1.05, wb = wt * 1.9;
    const gy = R1 + rowH * 0.62, x = root.cx;
    const p = [{ x: x + (rnd() - 0.5) * 6, y: gy }, { x: x + 10, y: gy - rowH * 0.25 }, { x: x - 8, y: root.cy + rowH * 0.25 }, { x, y: root.cy }];
    let t = `<path d="${taper(p, wb, wt)}" fill="${wood}"/>` + bark(p, wb, wt);
    [-1, 1, -1, 1].forEach((side, i) => {
      const len = 55 + rnd() * 90, sx = x + side * wb * (0.18 + rnd() * 0.12);
      const rp = [{ x: sx, y: gy - 6 }, { x: sx + side * len * 0.35, y: gy + 2 }, { x: sx + side * len * 0.7, y: gy + 4 + rnd() * 5 }, { x: sx + side * len, y: gy + 6 + rnd() * 8 }];
      t = `<path d="${taper(rp, wb * (i < 2 ? 0.42 : 0.3), 1)}" fill="${wood}"/>` + t;
    });
    ground += `<ellipse cx="${f1(x)}" cy="${f1(gy + 8)}" rx="${f1(wb * 9)}" ry="12" fill="${c.ink}" opacity=".07"/>`;
    ground += `<path d="M${f1(x - wb * 11)} ${f1(gy + 6)}C${f1(x - wb * 5)} ${f1(gy + 1)},${f1(x - wb * 2)} ${f1(gy + 9)},${f1(x)} ${f1(gy + 5)}S${f1(x + wb * 6)} ${f1(gy + 2)},${f1(x + wb * 11)} ${f1(gy + 7)}" fill="none" stroke="${wood}" stroke-opacity=".55" stroke-width="1.1" stroke-linecap="round"/>`;
    for (let i = 0; i < 18; i++) {
      const gx = x - wb * 10 + rnd() * wb * 20, h = 5 + rnd() * 7;
      ground += `<path d="M${f1(gx)} ${f1(gy + 6)}l${f1(-2 - rnd() * 2)} ${f1(-h)}M${f1(gx)} ${f1(gy + 6)}l${f1((rnd() - 0.5) * 2)} ${f1(-h - 3)}M${f1(gx)} ${f1(gy + 6)}l${f1(2 + rnd() * 2)} ${f1(-h + 1)}" stroke="${fol.leaves[0]}" stroke-opacity=".7" stroke-width="1" stroke-linecap="round"/>`;
    }
    grow(x - wb * 11, gy + 18); grow(x + wb * 11, gy + 18);
    woodSVG += `<g${anim("wood", 0)} data-beyond="${esc(beyond(root).join(" "))}">${t}</g>`;
  }

  // branches: split in pairs, taper by the family each branch carries, flow through forks
  const unit = (v: Pt) => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
  const turn = (v: Pt, r: number) => ({ x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) });
  function seg(a: Pt, b: Pt, w0: number, w1: number, d: number, bey: string[], key: string, tIn: Pt, tOut: Pt) {
    const rnd = rng(key), dy = a.y - b.y, dx = b.x - a.x, L = Math.hypot(dx, dy), wob = (rnd() - 0.5) * L * 0.06;
    const p = [a, { x: a.x + tIn.x * L * 0.4 + wob, y: a.y + tIn.y * L * 0.4 }, { x: b.x - tOut.x * L * 0.36 - wob, y: b.y - tOut.y * L * 0.36 }, b];
    let g = `<path d="${taper(p, w0, w1)}" fill="${wood}"/>` + bark(p, w0, w1), lv = "";
    for (let i = 0; L > 130 && i < fol.twigs; i++) {
      const t = 0.35 + rnd() * 0.35;
      const x = bez(p[0].x, p[1].x, p[2].x, p[3].x, t), y = bez(p[0].y, p[1].y, p[2].y, p[3].y, t);
      const tang = Math.atan2(bezD(p[0].y, p[1].y, p[2].y, p[3].y, t), bezD(p[0].x, p[1].x, p[2].x, p[3].x, t));
      const side = rnd() < 0.5 ? 1 : -1, ang = tang + side * (0.6 + rnd() * 0.4), len = 24 + rnd() * 34;
      const ex = x + Math.cos(ang) * len, ey = Math.min(y - 6, y + Math.sin(ang) * len);
      const tp = [{ x, y }, { x: x + Math.cos(ang) * len * 0.4, y: y + Math.sin(ang) * len * 0.4 - 4 }, { x: ex - Math.cos(ang) * len * 0.2, y: ey + 3 }, { x: ex, y: ey }];
      g += `<path d="${taper(tp, Math.min(4.5, (w0 + (w1 - w0) * t) * 0.45), 0.9, 12)}" fill="${wood}"/>`;
      lv += cluster(ex, ey, 4 + Math.floor(rnd() * 4), ang * 180 / Math.PI, 150, rnd);
    }
    for (let i = 0; i < fol.along; i++) {
      const t = 0.2 + rnd() * 0.65, x = bez(p[0].x, p[1].x, p[2].x, p[3].x, t), y = bez(p[0].y, p[1].y, p[2].y, p[3].y, t);
      const tang = Math.atan2(bezD(p[0].y, p[1].y, p[2].y, p[3].y, t), bezD(p[0].x, p[1].x, p[2].x, p[3].x, t)) * 180 / Math.PI;
      const side = i % 2 ? 1 : -1, ww = (w0 + (w1 - w0) * t) / 2;
      lv += leaf(x + Math.cos((tang + 90 * side) * Math.PI / 180) * ww, y + Math.sin((tang + 90 * side) * Math.PI / 180) * ww, tang + side * (50 + rnd() * 30), 0.65 + rnd() * 0.4, rnd);
    }
    woodSVG += `<g${anim("wood", d)} data-beyond="${esc(bey.join(" "))}">${g}</g>`;
    if (lv) leafSVG += `<g${anim("foliage", d + 1)}>${lv}</g>`;
  }
  function branch(from: Pt, list: GNode[], d: number, key: string, tIn: Pt) {
    if (list.length === 1) {
      const k = list[0], w = wid(weight(k)), dx = k.cx - from.x, dy = from.y - k.cy;
      seg(from, { x: k.cx, y: k.cy }, w * 1.1, Math.max(2.6, w * 0.62), d, beyond(k), key + ">" + k.id, tIn, unit({ x: dx * 0.25 / Math.max(dy, 1), y: -1 }));
      return;
    }
    const sorted = [...list].sort((a, b) => a.cx - b.cx), half = Math.ceil(sorted.length / 2);
    [sorted.slice(0, half), sorted.slice(half)].forEach((grp, gi) => {
      const t0 = unit(turn(tIn, (gi === 0 ? -1 : 1) * 0.28));
      if (grp.length === 1) return branch(from, grp, d, key + "/" + gi, t0);
      const wt = grp.reduce((a, k) => a + weight(k), 0), w = wid(wt);
      const fx = grp.reduce((a, k) => a + k.cx * weight(k), 0) / wt;
      const nearY = Math.max(...grp.map((k) => k.cy + rad(k)));
      const fork = { x: from.x + (fx - from.x) * 0.62, y: from.y - (from.y - nearY) * 0.46 };
      const chord = unit({ x: fork.x - from.x, y: fork.y - from.y });
      const tFork = unit({ x: chord.x * 0.6, y: chord.y * 0.6 - 0.4 });
      seg(from, fork, w * 1.08, w * 0.95, d, grp.flatMap(beyond), key + "/" + gi, t0, tFork);
      branch(fork, grp, d + 0.4, key + "/" + gi, tFork);
    });
  }
  walk(root, (g) => { if (g.kids.length) branch({ x: g.cx, y: g.cy }, g.kids, g.depth + 1, g.id, { x: 0, y: -1 }); });

  // medallions
  const order: GNode[] = []; walk(root, (g) => order.push(g));
  order.sort((a, b) => b.cy - a.cy).forEach((g) => {
    const R = rad(g), p = P(g.id), sp = g.members.slice(1).map(P);
    const isAnchor = lab && !!o.anchor && g.members.includes(o.anchor);
    const n1 = getFullName(p), n2 = sp.length ? "& " + getFullName(sp[0]) + (sp.length > 1 ? ` +${sp.length - 1}` : "") : "";
    const fit = (s: string, base: number, room: number) => Math.min(base, base * room / Math.max(room, Array.from(s).length));
    const yrs = yearsLabel(p), deceased = !!p.death;
    let txt = "";
    if (n2) {
      txt += `<text y="-7" text-anchor="middle" class="ser" font-size="${fit(n1, 13.5, 11).toFixed(1)}" font-weight="500" fill="${deceased ? c.ink2 : c.ink}">${esc(truncate(n1, 18))}</text>`;
      txt += `<text y="9" text-anchor="middle" class="ser" font-style="italic" font-size="${fit(n2, 11.5, 13).toFixed(1)}" fill="${c.ink2}">${esc(truncate(n2, 20))}</text>`;
      if (yrs) txt += `<text y="24" text-anchor="middle" class="mono" font-size="8.5" fill="${c.ink3}">${esc(yrs)}</text>`;
    } else {
      txt += `<text y="${yrs ? -1 : 4}" text-anchor="middle" class="ser" font-size="${fit(n1, 13.5, 10).toFixed(1)}" font-weight="500" fill="${deceased ? c.ink2 : c.ink}">${esc(truncate(n1, 16))}</text>`;
      if (yrs) txt += `<text y="14" text-anchor="middle" class="mono" font-size="8.5" fill="${c.ink3}">${esc(yrs)}</text>`;
    }
    let pill = "";
    if (lab) {
      const ls = g.members.map((id) => labelFor(people, byId, o, id)).filter((l): l is { en: string; ta: string } => !!l);
      if (ls.length) {
        const single = g.members.length === 1 && ls[0].en;
        const ta = ls.map((l) => l.ta).join(" · "), en = single ? ls[0].en : "";
        const wTa = Array.from(ta).length * 7.2, wEn = Array.from(en).length * 5.4, maxW = SLOT * 0.96;
        const k = Math.min(1, (maxW - 16) / Math.max(wTa, wEn, 1)), pwd = Math.min(Math.max(wTa, wEn) * k + 16, maxW), ph2 = en ? 32 : 20;
        pill = `<rect x="${f1(-pwd / 2)}" y="${R + 5}" width="${f1(pwd)}" height="${ph2}" rx="10" fill="${c.card}" stroke="${c.rule}"/>` +
          (en ? `<text y="${R + 17}" text-anchor="middle" class="ser" font-style="italic" font-size="${(9.5 * k).toFixed(2)}" fill="${c.ink2}">${esc(en)}</text>` : "") +
          `<text y="${R + (en ? 30 : 19)}" text-anchor="middle" class="ta" font-size="${(11 * k).toFixed(2)}" fill="${c.accent}">${esc(ta)}</text>`;
        grow(g.cx, g.cy + R + 5 + ph2);
      }
    }
    const inter = view.interactive ? ` class="pcard" data-id="${esc(g.id)}" data-beyond="${esc(beyond(g).join(" "))}" tabindex="0" role="button" aria-label="${esc(g.members.map((id) => getFullName(P(id))).join(" & "))}: show relations as seen by ${esc(n1)}"` : "";
    meds += `<g${inter} transform="translate(${f1(g.cx)} ${f1(g.cy)})"><circle class="frame" r="${R}" fill="${c.card}" stroke="${isAnchor ? c.accent : c.line}" stroke-width="${isAnchor ? 2.4 : 1.3}"/><circle r="${R - 4}" fill="none" stroke="${c.rule}" stroke-width=".8"/>${txt}${pill}</g>`;
    grow(g.cx, g.cy, R + 4);
  });

  const peopleIds: string[] = []; walk(root, (g) => peopleIds.push(...g.members));
  return { svg: canopy + ground + woodSVG + leafSVG + meds, bounds: { minX, minY, maxX, maxY }, people: peopleIds, gens: maxDepth + 1 };
}

// ---------- Register: cards with orthogonal lines ----------
function registerNodes(people: Person[], byId: Map<string, Person>, o: PosterOptions): { id: string; x: number; gen: number }[] {
  if (o.include === "anc") {
    if (!o.focus || !byId.has(o.focus)) return [];
    const out: { id: string; x: number; d: number }[] = [], seen = new Set<string>(), GAPA = 36;
    type T = { id: string; d: number; sub: T[]; sw: number; w: number };
    const m = (pid: string, d: number): T => {
      seen.add(pid);
      const sub = byId.get(pid)!.parentIds.filter((q) => byId.has(q) && !seen.has(q)).map((q) => m(q, d + 1));
      const sw = sub.length ? sub.reduce((a, t) => a + t.w, 0) + (sub.length - 1) * GAPA : 0;
      return { id: pid, d, sub, sw, w: Math.max(W, sw) };
    };
    const pl = (t: T, left: number) => {
      out.push({ id: t.id, x: left + (t.w - W) / 2, d: t.d });
      let x = left + (t.w - t.sw) / 2;
      t.sub.forEach((s) => { pl(s, x); x += s.w + GAPA; });
    };
    pl(m(o.focus, 0), 0);
    const maxD = Math.max(...out.map((n) => n.d));
    return out.map((n) => ({ id: n.id, x: n.x, gen: maxD - n.d }));
  }
  const layout = layoutFamily(people.map((p) => ({ ...p, position: null })), o.include === "desc" && o.focus ? { rootId: o.focus } : {});
  return Array.from(layout.nodes.values()).map((n) => ({ id: n.id, x: n.x, gen: n.gen }));
}

function labelSVG(l: { en: string; ta: string } | null, c: Palette) {
  if (!l) return "";
  const est = Array.from(l.en).length * 6.1 + (l.en ? 14 : 0) + Array.from(l.ta).length * 5.4;
  const fs = Math.max(8, Math.min(12, 12 * (W - 24) / Math.max(est, 1)));
  const en = l.en ? `<tspan class="ser" font-style="italic" fill="${c.ink2}">${esc(l.en)}</tspan><tspan fill="${c.ink3}"> · </tspan>` : "";
  return `<text x="${W / 2}" y="72" text-anchor="middle" font-size="${fs.toFixed(2)}">${en}<tspan class="ta" fill="${c.accent}">${esc(l.ta)}</tspan></text>`;
}

// ---------- the poster ----------
export function buildPosterSVG(people: Person[], o: PosterOptions, fontCSS = "", view: PosterView = {}): string {
  const byId = new Map(people.map((p) => [p.id, p]));
  const c = PAL[o.style], illus = o.style === "illus";
  const { w: pw, h: ph } = paperDims(o);
  const lab = o.labels !== "names";
  const m = Math.min(pw, ph) * 0.07;
  const titleH = Math.min(pw, ph) * (o.size === "phone" ? 0.22 : 0.13), footH = Math.min(pw, ph) * 0.05;
  const ax = m, ay = m + titleH, aw = pw - 2 * m, ah = ph - 2 * m - titleH - footH;
  let inner = "", bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null, peopleIds: string[] = [], gens = 0;

  if (illus) {
    const it = illusTree(people, byId, o, c, view, aw / ah);
    if (it) { inner = it.svg; bounds = it.bounds; peopleIds = it.people; gens = it.gens; }
  } else {
    const nodes = registerNodes(people, byId, o).map((n) => ({ ...n, y: 0, cx: 0 }));
    const CH = lab ? 80 : 60, flip = o.dir === "bottom";
    const maxGen = nodes.length ? Math.max(...nodes.map((n) => n.gen)) : 0;
    let LV = 76; // stretch rows to the page's shape so wide families don't collapse into a strip
    if (nodes.length && maxGen > 0) {
      const cw = Math.max(...nodes.map((n) => n.x + W)) - Math.min(...nodes.map((n) => n.x));
      LV = clamp((cw / (aw / ah) - (maxGen + 1) * CH) / maxGen, 76, 240);
    }
    const rowH = CH + LV;
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    nodes.forEach((n) => { n.y = (flip ? maxGen - n.gen : n.gen) * rowH; n.cx = n.x + W / 2; });
    let lines = "", cards = "";
    const pairs = new Set<string>();
    for (const p of people) for (const s of p.spouseIds) {
      const key = [p.id, s].sort().join("|"); if (pairs.has(key)) continue; pairs.add(key);
      const a = nodeById.get(p.id), b = nodeById.get(s);
      if (!a || !b || a.y !== b.y) continue;
      const l = a.x < b.x ? a : b, r = a.x < b.x ? b : a;
      if (r.x - (l.x + W) <= 0) continue;
      const y = l.y + CH / 2, dash = p.marriages.find((mm) => mm.spouseId === s)?.divorced ? ' stroke-dasharray="4 3"' : "";
      lines += `<line x1="${l.x + W}" x2="${r.x}" y1="${y - 2.5}" y2="${y - 2.5}" stroke="${c.line}" stroke-width="1.25"${dash}/><line x1="${l.x + W}" x2="${r.x}" y1="${y + 2.5}" y2="${y + 2.5}" stroke="${c.line}" stroke-width="1.25"${dash}/>`;
    }
    const groups = new Map<string, { ps: string[]; kids: typeof nodes }>();
    for (const n of nodes) {
      const ps = byId.get(n.id)!.parentIds.filter((q) => nodeById.has(q));
      if (!ps.length) continue;
      const k = [...ps].sort().join("|");
      if (!groups.has(k)) groups.set(k, { ps, kids: [] });
      groups.get(k)!.kids.push(n);
    }
    groups.forEach((g) => {
      const pn = g.ps.map((q) => nodeById.get(q)!).sort((a, b) => a.x - b.x);
      const prow = pn[0].y, below = g.kids[0].y > prow;
      const pEdge = below ? prow + CH : prow;
      let ox = pn[0].cx, oy = pEdge;
      if (pn.length === 2 && pn[0].y === pn[1].y && byId.get(pn[0].id)!.spouseIds.includes(pn[1].id)) { ox = (pn[0].cx + pn[1].cx) / 2; oy = prow + CH / 2; }
      const kEdge = (k: (typeof nodes)[number]) => (below ? k.y : k.y + CH);
      const midY = (pEdge + kEdge(g.kids[0])) / 2;
      const xs = g.kids.map((k) => k.cx).concat(ox);
      let d = `M${ox} ${oy}V${midY}M${Math.min(...xs)} ${midY}H${Math.max(...xs)}`;
      g.kids.forEach((k) => { d += `M${k.cx} ${midY}V${kEdge(k)}`; });
      lines += `<path d="${d}" fill="none" stroke="${c.line}" stroke-width="1.25" stroke-linejoin="round"/>`;
    });
    for (const n of nodes) {
      const p = byId.get(n.id)!, yrs = yearsLabel(p), label = labelFor(people, byId, o, n.id);
      const ny = lab ? (yrs ? 25 : 32) : (yrs ? 27 : 35);
      const isAnchor = lab && n.id === o.anchor;
      const inter = view.interactive ? ` class="pcard" data-id="${esc(n.id)}" data-beyond="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(getFullName(p))}: show relations as seen by them"` : "";
      cards += `<g${inter} transform="translate(${n.x} ${n.y})">
        <rect class="frame" width="${W}" height="${CH}" rx="10" fill="${c.card}" stroke="${isAnchor ? c.accent : c.rule}" stroke-width="${isAnchor ? 1.6 : 1}"/>
        <circle cx="30" cy="30" r="18" fill="${c.portrait}"/>
        <text x="30" y="35.5" text-anchor="middle" class="ser" font-size="15" fill="${c.ink2}">${esc(initial(p))}</text>
        <text x="58" y="${ny}" class="ser" font-size="15.5" font-weight="500" fill="${p.death ? c.ink2 : c.ink}">${esc(truncate(getFullName(p), 17))}</text>
        ${yrs ? `<text x="58" y="${ny + 18}" class="mono" font-size="10.5" fill="${c.ink3}">${esc(yrs)}</text>` : ""}
        ${lab ? `<line x1="12" x2="${W - 12}" y1="56" y2="56" stroke="${c.rule}"/>${labelSVG(label, c)}` : ""}
      </g>`;
    }
    inner = lines + cards;
    peopleIds = nodes.map((n) => n.id);
    gens = new Set(nodes.map((n) => n.gen)).size;
    if (nodes.length) bounds = { minX: Math.min(...nodes.map((n) => n.x)), maxX: Math.max(...nodes.map((n) => n.x + W)), minY: Math.min(...nodes.map((n) => n.y)), maxY: Math.max(...nodes.map((n) => n.y + CH)) };
  }

  let body = "";
  if (bounds && peopleIds.length) {
    const cw = bounds.maxX - bounds.minX, ch = bounds.maxY - bounds.minY;
    const s = Math.min(aw / cw, ah / ch, 2.2);
    const tx = ax + (aw - cw * s) / 2 - bounds.minX * s, ty = ay + (ah - ch * s) / 2 - bounds.minY * s;
    body = `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">${inner}</g>`;
  }

  const T = Math.min(pw, ph) * (o.size === "phone" ? 0.085 : 0.055);
  const ppl = peopleIds.length, yrsAll = peopleIds.map((id) => yearOf(byId.get(id)?.birth?.date)).filter((y): y is number => y != null);
  const lo = yrsAll.length ? Math.min(...yrsAll) : null, hi = yrsAll.length ? Math.max(...yrsAll) : null;
  const span = lo == null ? "" : lo === hi ? `since ${lo}` : `${lo} – ${hi}`;
  const sub = [`${gens} generation${gens === 1 ? "" : "s"}`, span, `${ppl} ${ppl === 1 ? "person" : "people"}`].filter(Boolean).join("  ·  ");
  const nameById = (id: string | null) => (id && byId.has(id) ? getFullName(byId.get(id)!) : "");
  const who = lab && o.anchor ? `Relations as seen by ${nameById(o.anchor)}` : o.include === "desc" ? `Descendants of ${nameById(o.focus)}` : o.include === "anc" ? `Ancestors of ${nameById(o.focus)}` : "";
  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  let head: string, frame: string;
  if (illus) {
    frame = `<rect x="${m * 0.45}" y="${m * 0.45}" width="${pw - m * 0.9}" height="${ph - m * 0.9}" fill="none" stroke="${c.line}" stroke-width="1.4"/><rect x="${m * 0.58}" y="${m * 0.58}" width="${pw - m * 1.16}" height="${ph - m * 1.16}" fill="none" stroke="${c.line}" stroke-width=".6"/>`;
    head = `<text x="${pw / 2}" y="${m + T}" text-anchor="middle" class="ser" font-style="italic" font-size="${T}" fill="${c.ink}">${esc(o.title)}</text>
      <text x="${pw / 2}" y="${m + T * 1.62}" text-anchor="middle" class="mono" font-size="${T * 0.28}" letter-spacing="${T * 0.03}" fill="${c.ink3}">${esc(sub.toUpperCase())}</text>
      ${who ? `<text x="${pw / 2}" y="${m + T * 2.1}" text-anchor="middle" class="ser" font-style="italic" font-size="${T * 0.36}" fill="${c.ink2}">${esc(who)}</text>` : ""}`;
  } else {
    frame = `<rect x="${m * 0.5}" y="${m * 0.5}" width="${pw - m}" height="${ph - m}" fill="none" stroke="${c.rule}" stroke-width="1.2"/>`;
    head = `<text x="${m}" y="${m + T * 0.85}" class="ser" font-size="${T}" fill="${c.ink}">${esc(o.title)}</text>
      <text x="${m}" y="${m + T * 1.5}" class="mono" font-size="${T * 0.28}" letter-spacing="${T * 0.03}" fill="${c.ink3}">${esc(sub.toUpperCase())}</text>
      ${who ? `<text x="${pw - m}" y="${m + T * 1.5}" text-anchor="end" class="ser" font-style="italic" font-size="${T * 0.34}" fill="${c.ink2}">${esc(who)}</text>` : ""}
      <line x1="${m}" x2="${pw - m}" y1="${m + T * 1.85}" y2="${m + T * 1.85}" stroke="${c.rule}" stroke-width="1"/>`;
  }
  const fs = Math.min(pw, ph) * 0.014;
  const foot = `<text x="${m}" y="${ph - m * 0.85}" class="mono" font-size="${fs}" fill="${c.ink3}">Family Tree Builder</text><text x="${pw - m}" y="${ph - m * 0.85}" text-anchor="end" class="mono" font-size="${fs}" fill="${c.ink3}">${esc(month)}</text>`;
  const fonts = view.fonts ?? PREVIEW_FONTS;
  const empty = ppl ? "" : `<text x="${pw / 2}" y="${ph / 2}" text-anchor="middle" class="ser" font-size="${T * 0.6}" fill="${c.ink3}">No one to show yet</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pw} ${ph}" width="${pw}" height="${ph}" role="img" aria-label="${esc(o.title)} — family tree poster">
<style>${fontCSS}
.ser{font-family:${fonts.serif}}
.mono{font-family:${fonts.mono}}
.ta{font-family:${fonts.tamil};font-weight:600}
</style>
${illus ? `<defs><g id="lf"><path d="M0 0C4 -6 12 -7 18 0C12 7 4 6 0 0Z"/><path d="M2 0H15" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width=".7"/></g></defs>` : ""}<rect width="${pw}" height="${ph}" fill="${c.paper}"/>${frame}${head}${body}${empty}${foot}
</svg>`;
}

// Count of people who would appear on the poster (for the "A3 or larger" hint)
export function posterPeopleCount(svg: string): number {
  return (svg.match(/class="pcard"/g) ?? []).length;
}
