import { describe, expect, it } from "vitest";
import { canSetParents, graphReducer, historyReducer, initialHistory, normalize } from "./graph";
import { createEmptyPerson, Marriage, Person } from "./types";

const P = (id: string, extra: Partial<Person> = {}): Person => ({ ...createEmptyPerson(id), name: id, ...extra });
const marriage = (spouseId: string, extra: Partial<Marriage> = {}): Marriage => ({ spouseId, date: "", place: "", divorced: false, divorceDate: "", divorcePlace: "", ...extra });
const get = (people: Person[], id: string) => people.find((p) => p.id === id)!;

describe("normalize", () => {
  it("repairs one-sided links from older files", () => {
    const { people, report } = normalize([
      P("a", { spouseIds: ["b"], childIds: ["c"] }),
      P("b"),
      P("c"),
      P("d", { parentIds: ["a", "ghost"] }),
      P("a"), // duplicate id
    ]);
    expect(get(people, "b").spouseIds).toEqual(["a"]);
    expect(get(people, "c").parentIds).toEqual(["a"]);
    expect(get(people, "a").childIds.sort()).toEqual(["c", "d"]);
    expect(get(people, "d").parentIds).toEqual(["a"]);
    expect(report.duplicatesRemoved).toBe(1);
    expect(report.danglingRefsRemoved).toBe(1);
    expect(report.linksRepaired).toBeGreaterThan(0);
  });
  it("caps parents at two and mirrors marriage details", () => {
    const { people, report } = normalize([
      P("k", { parentIds: ["x", "y", "z"] }), P("x"), P("y"), P("z"),
      P("h", { marriages: [marriage("w", { date: "1984", place: "Madurai" })] }), P("w"),
    ]);
    expect(get(people, "k").parentIds).toHaveLength(2);
    expect(report.extraParentsDropped).toBe(1);
    expect(get(people, "w").marriages[0]).toMatchObject({ spouseId: "h", date: "1984", place: "Madurai" });
    expect(get(people, "w").spouseIds).toEqual(["h"]);
  });
});

describe("graphReducer", () => {
  const base = normalize([
    P("arul", { spouseIds: ["meena"], marriages: [marriage("meena", { date: "1959" })] }),
    P("meena"),
    P("kamala", { parentIds: ["arul", "meena"] }),
  ]).people;

  it("removing a marriage removes it on BOTH spouses (audit D-02)", () => {
    const next = graphReducer(base, { type: "setMarriages", id: "arul", marriages: [] });
    expect(get(next, "arul").spouseIds).toEqual([]);
    expect(get(next, "meena").spouseIds).toEqual([]);
    expect(get(next, "meena").marriages).toEqual([]);
  });
  it("adding/changing a marriage mirrors the details", () => {
    const withRaja = graphReducer([...base, P("raja")], { type: "addPerson", person: P("x") });
    const next = graphReducer(withRaja, { type: "setMarriages", id: "kamala", marriages: [marriage("raja", { date: "1984", divorced: true })] });
    expect(get(next, "raja").spouseIds).toEqual(["kamala"]);
    expect(get(next, "raja").marriages[0]).toMatchObject({ spouseId: "kamala", date: "1984", divorced: true });
  });
  it("changes and removes parents both ways (audit D-03)", () => {
    const next = graphReducer(base, { type: "setParents", id: "kamala", parentIds: ["meena"] });
    expect(get(next, "kamala").parentIds).toEqual(["meena"]);
    expect(get(next, "arul").childIds).toEqual([]);
    expect(get(next, "meena").childIds).toEqual(["kamala"]);
  });
  it("refuses cycles and more than two parents", () => {
    expect(canSetParents(base, "arul", ["kamala"]).ok).toBe(false);
    expect(graphReducer(base, { type: "setParents", id: "arul", parentIds: ["kamala"] })).toBe(base);
    expect(canSetParents(base, "kamala", ["arul", "meena", "x"]).ok).toBe(false);
  });
  it("adds a person and mirrors their links", () => {
    const next = graphReducer(base, { type: "addPerson", person: P("ashwin", { parentIds: ["kamala"] }) });
    expect(get(next, "kamala").childIds).toEqual(["ashwin"]);
  });
  it("deletes a person and every reference to them", () => {
    const next = graphReducer(base, { type: "deletePerson", id: "meena" });
    expect(next.map((p) => p.id)).toEqual(["arul", "kamala"]);
    expect(get(next, "arul").spouseIds).toEqual([]);
    expect(get(next, "kamala").parentIds).toEqual(["arul"]);
  });
  it("updateFields cannot touch relationships", () => {
    const next = graphReducer(base, { type: "updateFields", id: "kamala", fields: { givenName: "Kamala" } });
    expect(get(next, "kamala").givenName).toBe("Kamala");
    expect(get(next, "kamala").parentIds).toEqual(["arul", "meena"]);
  });
});

describe("historyReducer", () => {
  it("undoes and redoes, and a drag collapses into one step", () => {
    let s = historyReducer(initialHistory, { type: "load", people: [P("a")] });
    s = historyReducer(s, { type: "addPerson", person: P("b") });
    s = historyReducer(s, { type: "setPositions", positions: { a: { x: 1, y: 1 } }, coalesceKey: "drag-1" });
    s = historyReducer(s, { type: "setPositions", positions: { a: { x: 2, y: 2 } }, coalesceKey: "drag-1" });
    expect(s.past).toHaveLength(2);
    s = historyReducer(s, { type: "undo" });
    expect(get(s.present, "a").position).toBeNull();
    s = historyReducer(s, { type: "undo" });
    expect(s.present.map((p) => p.id)).toEqual(["a"]);
    s = historyReducer(s, { type: "redo" });
    expect(s.present.map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("updatePerson", () => {
  it("applies fields, parents and marriages as one step", () => {
    const base = normalize([P("a"), P("b"), P("c", { parentIds: ["a"] })]).people;
    const edited = { ...get(base, "c"), givenName: "Cee", parentIds: ["a", "b"], marriages: [] };
    let s = historyReducer(initialHistory, { type: "load", people: base });
    s = historyReducer(s, { type: "updatePerson", person: edited });
    expect(get(s.present, "c")).toMatchObject({ givenName: "Cee", parentIds: ["a", "b"] });
    expect(get(s.present, "b").childIds).toEqual(["c"]);
    expect(s.past).toHaveLength(1);
  });
});
