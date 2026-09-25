import { describe, expect, it } from "vitest";
import { buildPosterSVG, mainRoot, paperDims, PosterOptions } from "./poster";
import { normalize } from "./graph";
import { createEmptyPerson, Person } from "./types";

const fam = normalize(
  ([
    ["arul", "male", "1936", [], ["meena"]], ["meena", "female", "1941", []],
    ["kamala", "female", "1962", ["arul", "meena"], ["raja"]], ["raja", "male", "1958", []],
    ["sundar", "male", "1966", ["arul", "meena"], ["lakshmi"]], ["lakshmi", "female", "1970", []],
    ["ashwin", "male", "1987", ["kamala", "raja"]], ["vishal", "male", "1998", ["sundar", "lakshmi"]],
  ] as [string, Person["gender"], string, string[], string[]?][]).map(([id, gender, born, parentIds, spouseIds = []]) => ({
    ...createEmptyPerson(id), name: id[0].toUpperCase() + id.slice(1), gender, birth: { date: born, place: "" }, parentIds, spouseIds,
  }))
).people;

const base: PosterOptions = { title: "Arulmozhi family", style: "register", include: "whole", focus: null, rootId: null, dir: "top", labels: "names", anchor: null, size: "a4", orient: "landscape", foliage: "lush" };
const count = (svg: string, needle: RegExp) => (svg.match(needle) ?? []).length;

describe("buildPosterSVG", () => {
  it("register puts everyone on the page", () => {
    const svg = buildPosterSVG(fam, base, "", { interactive: true });
    expect(count(svg, /class="pcard"/g)).toBe(fam.length);
    expect(svg).toContain("3 GENERATIONS");
  });
  it("illustrated merges couples into medallions and keeps generations on one line", () => {
    const svg = buildPosterSVG(fam, { ...base, style: "illus" }, "", { interactive: true });
    expect(count(svg, /class="pcard"/g)).toBe(5); // arul&meena, kamala&raja, sundar&lakshmi, ashwin, vishal
    const ys = (id: string) => Number(svg.match(new RegExp(`data-id="${id}"[^>]*transform="translate\\([\\d.-]+ ([\\d.-]+)\\)`))![1]);
    expect(ys("ashwin")).toBe(ys("vishal"));
    expect(ys("kamala")).toBe(ys("sundar"));
  });
  it("labels relations from the chosen person, in Tamil", () => {
    const svg = buildPosterSVG(fam, { ...base, labels: "tamil", anchor: "vishal" });
    expect(svg).toContain("Relations as seen by Vishal");
    for (const t of ["அப்பா", "அத்தை", "தாத்தா", "நான்"]) expect(svg).toContain(t);
  });
  it("escapes names", () => {
    const evil = fam.map((p) => (p.id === "ashwin" ? { ...p, name: `<script>x</script>` } : p));
    expect(buildPosterSVG(evil, base)).not.toContain("<script>x");
  });
  it("ancestors and descendants focus on one person", () => {
    const anc = buildPosterSVG(fam, { ...base, include: "anc", focus: "vishal" }, "", { interactive: true });
    expect(count(anc, /class="pcard"/g)).toBe(5); // vishal, sundar, lakshmi, arul, meena
    const desc = buildPosterSVG(fam, { ...base, include: "desc", focus: "kamala" }, "", { interactive: true });
    expect(count(desc, /class="pcard"/g)).toBe(3);
  });
  it("sizes paper and finds the trunk", () => {
    expect(paperDims({ size: "a4", orient: "portrait" })).toMatchObject({ w: 840, h: 1188 });
    expect(mainRoot(fam)).toBe("arul");
    expect(buildPosterSVG(fam, { ...base, style: "illus", size: "phone" })).toContain('viewBox="0 0 645 1398"');
  });
  it("says 'since' when only one year is known", () => {
    const one = fam.map((p) => ({ ...p, birth: { date: p.id === "arul" ? "1936" : "", place: "" } }));
    expect(buildPosterSVG(one, base)).toContain("SINCE 1936");
  });
});
