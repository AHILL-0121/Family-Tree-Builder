import { Person, Position } from "./types";

// Shared family layout used by the canvas, relate mode and the poster.
//
// - Generations are global: a person's row is the longest parent chain above them, spouses
//   are pulled onto the same row, and parent-less people sit just above their children, so
//   every generation lines up across in-law families (audit V-03).
// - Each family "unit" (a bloodline person plus the spouses who married in) is laid out as a
//   tidy tree: a unit is centred over its children and sibling sub-trees never overlap (V-04).
// - Separate family trees (e.g. the in-laws) are placed side by side, so nobody is dropped.
// - Connectors are computed from final positions, so manual drags keep correct lines.

export const NODE_W = 184;
export const NODE_H = 60;
export const SPOUSE_GAP = 40;
export const SIBLING_GAP = 28;
export const ROW_GAP = 84;
export const TREE_GAP = 96;
export const ROW_H = NODE_H + ROW_GAP;

export interface LayoutNode {
  id: string;
  x: number; // top-left
  y: number;
  gen: number;
  unit: string; // bloodline person of the unit this node sits in
  marriedIn: boolean;
}

export interface MarriageBar {
  a: string;
  b: string;
  x1: number;
  x2: number;
  y: number;
  divorced: boolean;
}

export interface Descent {
  parents: string[];
  children: string[];
  path: string; // SVG path, orthogonal
}

export interface FamilyLayout {
  nodes: Map<string, LayoutNode>;
  bars: MarriageBar[];
  descents: Descent[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  generations: number[];
}

const byBirth = (a: Person, b: Person) => {
  const ya = Number(a.birth?.date?.match(/\d{4}/)?.[0] ?? 9999);
  const yb = Number(b.birth?.date?.match(/\d{4}/)?.[0] ?? 9999);
  return ya - yb;
};

export function computeGenerations(people: Person[]): Map<string, number> {
  const byId = new Map(people.map((p) => [p.id, p]));
  const children = new Map<string, string[]>(people.map((p) => [p.id, []]));
  for (const p of people) for (const pid of p.parentIds) children.get(pid)?.push(p.id);
  const gen = new Map<string, number>(people.map((p) => [p.id, 0]));
  const limit = people.length * 4 + 10; // cyclic data can't loop forever

  for (let round = 0; round < limit; round++) {
    let changed = false;
    for (const p of people) {
      // below every parent
      for (const pid of p.parentIds) {
        if (!byId.has(pid)) continue;
        const want = gen.get(pid)! + 1;
        if (gen.get(p.id)! < want) { gen.set(p.id, Math.min(want, people.length)); changed = true; }
      }
      // same row as spouses
      for (const sid of p.spouseIds) {
        if (!byId.has(sid)) continue;
        const g = Math.max(gen.get(p.id)!, gen.get(sid)!);
        if (gen.get(p.id)! !== g) { gen.set(p.id, g); changed = true; }
        if (gen.get(sid)! !== g) { gen.set(sid, g); changed = true; }
      }
      // parent-less people sit directly above their highest child
      if (!p.parentIds.some((pid) => byId.has(pid))) {
        const kids = children.get(p.id)!;
        if (kids.length) {
          const want = Math.min(...kids.map((k) => gen.get(k)!)) - 1;
          if (want > gen.get(p.id)! && !p.spouseIds.some((s) => byId.has(s) && gen.get(s)! > want)) {
            gen.set(p.id, want);
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
  return gen;
}

interface Unit {
  id: string;
  members: string[];
  kids: Unit[];
  width: number;
  membersWidth: number;
  kidsWidth: number;
  x: number;
}

export function layoutFamily(people: Person[], opts: { rootId?: string } = {}): FamilyLayout {
  const byId = new Map(people.map((p) => [p.id, p]));
  const empty: FamilyLayout = { nodes: new Map(), bars: [], descents: [], bounds: null, generations: [] };
  if (people.length === 0 || (opts.rootId && !byId.has(opts.rootId))) return empty;

  const gen = computeGenerations(people);
  const kidsOf = new Map<string, Person[]>(people.map((p) => [p.id, []]));
  for (const p of people) for (const pid of p.parentIds) kidsOf.get(pid)?.push(p);
  kidsOf.forEach((list) => list.sort(byBirth));
  const hasParents = (p: Person) => p.parentIds.some((id) => byId.has(id));
  const seen = new Set<string>();

  function build(id: string): Unit {
    seen.add(id);
    const p = byId.get(id)!;
    const spouses = p.spouseIds.filter((s) => byId.has(s) && !seen.has(s));
    spouses.forEach((s) => seen.add(s));
    const members = spouses.length >= 2 ? [spouses[0], id, ...spouses.slice(1)] : [id, ...spouses];
    const kids: Unit[] = [];
    for (const k of kidsOf.get(id)!) if (!seen.has(k.id)) kids.push(build(k.id));
    // children of a married-in spouse from another relationship still belong here
    for (const s of spouses) for (const k of kidsOf.get(s)!) if (!seen.has(k.id)) kids.push(build(k.id));
    const membersWidth = members.length * NODE_W + (members.length - 1) * SPOUSE_GAP;
    const kidsWidth = kids.length ? kids.reduce((a, k) => a + k.width, 0) + (kids.length - 1) * SIBLING_GAP : 0;
    return { id, members, kids, membersWidth, kidsWidth, width: Math.max(membersWidth, kidsWidth), x: 0 };
  }

  // Roots: the requested person, or everyone without parents who isn't just married into a family
  let roots: string[];
  if (opts.rootId) {
    roots = [opts.rootId];
  } else {
    const candidates = people.filter((p) => !hasParents(p) && !p.spouseIds.some((s) => byId.has(s) && hasParents(byId.get(s)!)));
    const size = (id: string, acc = new Set<string>()): number => {
      if (acc.has(id)) return 0;
      acc.add(id);
      return 1 + (kidsOf.get(id) ?? []).reduce((a, k) => a + size(k.id, acc), 0);
    };
    roots = candidates.sort((a, b) => gen.get(a.id)! - gen.get(b.id)! || size(b.id) - size(a.id)).map((p) => p.id);
  }

  const trees: Unit[] = [];
  for (const r of roots) if (!seen.has(r)) trees.push(build(r));
  if (!opts.rootId) for (const p of people) if (!seen.has(p.id)) trees.push(build(p.id)); // cycles / leftovers

  const nodes = new Map<string, LayoutNode>();
  function place(u: Unit, left: number) {
    const mx = left + (u.width - u.membersWidth) / 2;
    u.members.forEach((m, i) => {
      nodes.set(m, { id: m, x: mx + i * (NODE_W + SPOUSE_GAP), y: 0, gen: gen.get(m)!, unit: u.id, marriedIn: m !== u.id });
    });
    let kx = left + (u.width - u.kidsWidth) / 2;
    for (const k of u.kids) { place(k, kx); kx += k.width + SIBLING_GAP; }
  }
  let left = 0;
  for (const t of trees) { place(t, left); left += t.width + TREE_GAP; }

  // Rows: descendants mode starts its root at row 0
  const base = opts.rootId ? gen.get(opts.rootId)! : 0;
  nodes.forEach((n) => { n.gen -= base; n.y = n.gen * ROW_H; });

  // Manual positions (drag) override the automatic layout
  nodes.forEach((n) => {
    const pos = byId.get(n.id)!.position;
    if (pos) { n.x = pos.x; n.y = pos.y; }
  });

  return { nodes, ...connectors(people, nodes), bounds: boundsOf(nodes), generations: Array.from(new Set(Array.from(nodes.values()).map((n) => n.gen))).sort((a, b) => a - b) };
}

function boundsOf(nodes: Map<string, LayoutNode>) {
  if (!nodes.size) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W); maxY = Math.max(maxY, n.y + NODE_H);
  });
  return { minX, minY, maxX, maxY };
}

export function connectors(people: Person[], nodes: Map<string, LayoutNode>): { bars: MarriageBar[]; descents: Descent[] } {
  const byId = new Map(people.map((p) => [p.id, p]));
  const bars: MarriageBar[] = [];
  const done = new Set<string>();
  for (const p of people) {
    for (const s of p.spouseIds) {
      const key = [p.id, s].sort().join("|");
      if (done.has(key)) continue;
      done.add(key);
      const a = nodes.get(p.id), b = nodes.get(s);
      if (!a || !b || Math.abs(a.y - b.y) > 1) continue;
      const l = a.x < b.x ? a : b, r = a.x < b.x ? b : a;
      if (r.x - (l.x + NODE_W) <= 0) continue;
      const m = p.marriages.find((mm) => mm.spouseId === s);
      bars.push({ a: l.id, b: r.id, x1: l.x + NODE_W, x2: r.x, y: l.y + NODE_H / 2, divorced: !!m?.divorced });
    }
  }

  const groups = new Map<string, { parents: string[]; children: string[] }>();
  for (const p of people) {
    if (!nodes.has(p.id)) continue;
    const parents = p.parentIds.filter((id) => nodes.has(id));
    if (!parents.length) continue;
    const key = [...parents].sort().join("|");
    if (!groups.has(key)) groups.set(key, { parents, children: [] });
    groups.get(key)!.children.push(p.id);
  }

  const descents: Descent[] = [];
  groups.forEach(({ parents, children }) => {
    const pn = parents.map((id) => nodes.get(id)!).sort((a, b) => a.x - b.x);
    const kids = children.map((id) => nodes.get(id)!);
    const parentBottom = Math.max(...pn.map((n) => n.y + NODE_H));
    const kidTop = Math.min(...kids.map((n) => n.y));
    let ox = pn[0].x + NODE_W / 2, oy = pn[0].y + NODE_H;
    const married = pn.length === 2 && byId.get(pn[0].id)?.spouseIds.includes(pn[1].id);
    if (married && Math.abs(pn[0].y - pn[1].y) <= 1) {
      const gap = pn[1].x - (pn[0].x + NODE_W);
      if (gap > 0 && gap <= SPOUSE_GAP * 3) { ox = pn[0].x + NODE_W + gap / 2; oy = pn[0].y + NODE_H / 2; }
      else ox = (pn[0].x + pn[1].x) / 2 + NODE_W / 2;
    }
    const midY = kidTop > parentBottom ? parentBottom + (kidTop - parentBottom) / 2 : parentBottom + ROW_GAP / 2;
    const xs = kids.map((k) => k.x + NODE_W / 2).concat(ox);
    let d = `M${ox} ${oy}V${midY}M${Math.min(...xs)} ${midY}H${Math.max(...xs)}`;
    for (const k of kids) d += `M${k.x + NODE_W / 2} ${midY}V${k.y}`;
    descents.push({ parents, children, path: d });
  });
  return { bars, descents };
}

// Positions of every node for "auto-align" (clears manual drags back to the computed layout)
export function autoPositions(people: Person[]): Record<string, Position | null> {
  return Object.fromEntries(people.map((p) => [p.id, null]));
}
