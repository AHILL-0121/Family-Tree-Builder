import { describe, expect, it } from "vitest";
import { createExportData, describeImport, importFamilyTree } from "./json-schema";

describe("importFamilyTree", () => {
  it("round-trips an export", () => {
    const first = importFamilyTree({
      version: 3,
      people: [
        { id: "a", givenName: "Arul", parentIds: [], spouseIds: ["b"], childIds: [] },
        { id: "b", givenName: "Meena", parentIds: [], spouseIds: ["a"] },
        { id: "c", givenName: "Kamala", parentIds: ["a", "b"], spouseIds: [] },
      ],
    });
    expect(first.ok).toBe(true);
    const again = importFamilyTree(JSON.parse(JSON.stringify(createExportData(first.data!.people))));
    expect(again.data!.people).toEqual(first.data!.people);
  });

  it("repairs and reports instead of failing on messy files", () => {
    const r = importFamilyTree({
      version: 3,
      people: [
        { id: "a", spouseIds: ["b"], childIds: ["c"] },
        { id: "b" },
        { id: "c", parentIds: ["ghost"] },
        { nope: true },
      ],
    });
    expect(r.ok).toBe(true);
    const c = r.data!.people.find((p) => p.id === "c")!;
    expect(c.parentIds).toEqual(["a"]);
    expect(r.report!.skipped).toBe(1);
    expect(describeImport(r.report!)).toContain("skipped");
  });

  it("migrates v1 single-name records", () => {
    const r = importFamilyTree({ version: 1, people: [{ id: 7, name: "Rasa Gounder", parentIds: [], spouseIds: [] }] });
    expect(r.data!.people[0]).toMatchObject({ id: "7", givenName: "Rasa", surname: "Gounder" });
  });

  it("rejects cycles, newer versions and non-tree files", () => {
    const cyclic = importFamilyTree({ version: 3, people: [{ id: "a", parentIds: ["b"] }, { id: "b", parentIds: ["a"] }] });
    expect(cyclic.ok).toBe(false);
    expect(cyclic.error).toMatch(/Cycle/);
    expect(importFamilyTree({ version: 99, people: [] }).ok).toBe(false);
    expect(importFamilyTree({ hello: "world" }).ok).toBe(false);
  });
});
