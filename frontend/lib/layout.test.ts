import { describe, expect, it } from "vitest";
import { computeGenerations, layoutFamily, NODE_W } from "./layout";
import { normalize } from "./graph";
import { createEmptyPerson, Person } from "./types";

const fam = (spec: [string, string[], string[]?][]): Person[] =>
  normalize(spec.map(([id, parentIds, spouseIds = []]) => ({ ...createEmptyPerson(id), name: id, parentIds, spouseIds }))).people;

const sample = fam([
  ["arul", [], ["meena"]], ["meena", []],
  ["kamala", ["arul", "meena"], ["raja"]], ["raja", []],
  ["sundar", ["arul", "meena"], ["lakshmi"]],
  ["nata", [], ["saras"]], ["saras", []],
  ["lakshmi", ["nata", "saras"]],
  ["gopal", ["nata", "saras"]],
  ["ashwin", ["kamala", "raja"]], ["nandhini", ["kamala", "raja"]],
  ["vishal", ["sundar", "lakshmi"]],
]);

const overlaps = (layout: ReturnType<typeof layoutFamily>) => {
  const list = Array.from(layout.nodes.values());
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.y === b.y && Math.abs(a.x - b.x) < NODE_W) return `${a.id} / ${b.id}`;
  }
  return null;
};

describe("computeGenerations", () => {
  it("puts spouses on one row and in-law parents right above their children", () => {
    const g = computeGenerations(sample);
    expect(g.get("raja")).toBe(g.get("kamala"));
    expect(g.get("lakshmi")).toBe(g.get("sundar"));
    expect(g.get("nata")).toBe(g.get("arul"));
    expect(g.get("vishal")).toBe(2);
  });
  it("terminates on cyclic data", () => {
    const cyclic = fam([["a", ["b"]], ["b", ["a"]]]);
    expect(() => computeGenerations(cyclic)).not.toThrow();
  });
});

describe("layoutFamily", () => {
  const layout = layoutFamily(sample);
  it("places everyone, including the in-law family (nobody dropped)", () => {
    expect(layout.nodes.size).toBe(sample.length);
  });
  it("never overlaps two people on the same row", () => {
    expect(overlaps(layout)).toBeNull();
  });
  it("keeps each generation on one line", () => {
    const y = (id: string) => layout.nodes.get(id)!.y;
    expect(y("ashwin")).toBe(y("vishal"));
    expect(y("lakshmi")).toBe(y("gopal"));
    expect(y("arul")).toBeLessThan(y("kamala"));
  });
  it("draws a marriage bar for adjacent spouses and a descent per parent set", () => {
    expect(layout.bars.some((b) => [b.a, b.b].sort().join() === "arul,meena")).toBe(true);
    expect(layout.descents.find((d) => d.children.includes("vishal"))?.parents.sort()).toEqual(["lakshmi", "sundar"]);
  });
  it("descendants mode starts at the chosen person", () => {
    const d = layoutFamily(sample, { rootId: "kamala" });
    expect(Array.from(d.nodes.keys()).sort()).toEqual(["ashwin", "kamala", "nandhini", "raja"]);
    expect(d.nodes.get("kamala")!.y).toBe(0);
  });
  it("honours manual positions", () => {
    const moved = sample.map((p) => (p.id === "vishal" ? { ...p, position: { x: 999, y: 777 } } : p));
    expect(layoutFamily(moved).nodes.get("vishal")).toMatchObject({ x: 999, y: 777 });
  });
  it("handles wide families without overlap", () => {
    const wide: [string, string[], string[]?][] = [["root", []]];
    for (let i = 0; i < 12; i++) {
      wide.push([`c${i}`, ["root"], [`s${i}`]], [`s${i}`, []]);
      for (let j = 0; j < (i % 4); j++) wide.push([`g${i}_${j}`, [`c${i}`, `s${i}`]]);
    }
    expect(overlaps(layoutFamily(fam(wide)))).toBeNull();
  });
});
