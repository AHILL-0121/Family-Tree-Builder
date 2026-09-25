import { describe, expect, it } from "vitest";
import { findCycle, validateTree, wouldCreateCycle } from "./cycles";
import { layoutFamily } from "./layout";
import { createEmptyPerson, Person } from "./types";

const person = (id: string, parentIds: string[] = []): Person => ({ ...createEmptyPerson(id), name: id, parentIds });

describe("wouldCreateCycle", () => {
  const people = [person("grandpa"), person("dad", ["grandpa"]), person("kid", ["dad"])];
  it("rejects self-parenting and descendants as parents", () => {
    expect(wouldCreateCycle(people, "kid", "kid")).toBe(true);
    expect(wouldCreateCycle(people, "grandpa", "kid")).toBe(true);
  });
  it("allows a new unrelated parent", () => {
    expect(wouldCreateCycle([...people, person("mum")], "kid", "mum")).toBe(false);
  });
});

describe("findCycle / validateTree", () => {
  it("finds a cycle and names it", () => {
    const cyclic = [person("root"), person("a", ["root", "b"]), person("b", ["a"])];
    expect(findCycle(cyclic)).not.toBeNull();
    expect(validateTree(cyclic).valid).toBe(false);
  });
  it("passes a normal tree", () => {
    expect(validateTree([person("a"), person("b", ["a"])]).valid).toBe(true);
  });
});

describe("layoutFamily", () => {
  it("terminates on cyclic data reachable from a root (used to hang the tab)", () => {
    const cyclic = [person("root"), person("a", ["root", "b"]), person("b", ["a"])];
    const layout = layoutFamily(cyclic);
    expect(layout.nodes.size).toBe(3);
  });
  it("places parents above children", () => {
    const layout = layoutFamily([person("p"), person("c", ["p"])]);
    const y = (id: string) => layout.nodes.get(id)!.y;
    expect(y("p")).toBeLessThan(y("c"));
  });
});
