import { Person } from "./types";

// Would making `potentialParentId` a parent of `childId` create a cycle?
// It would if the child is the potential parent, or is already one of their ancestors.
export function wouldCreateCycle(
  people: Person[],
  childId: string,
  potentialParentId: string
): boolean {
  if (childId === potentialParentId) return true;

  const peopleMap = new Map(people.map(p => [p.id, p]));
  const visited = new Set<string>();
  const stack = [potentialParentId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (currentId === childId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    peopleMap.get(currentId)?.parentIds.forEach(pid => stack.push(pid));
  }

  return false;
}

// Find a parent-child cycle anywhere in the tree (three-colour DFS over parent links).
export function findCycle(people: Person[]): string[] | null {
  const peopleMap = new Map(people.map(p => [p.id, p]));
  const state = new Map<string, 1 | 2>(); // 1 = on the current path, 2 = done
  const path: string[] = [];

  function visit(id: string): string[] | null {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return path.slice(path.indexOf(id)).concat(id);
    state.set(id, 1);
    path.push(id);
    for (const pid of peopleMap.get(id)?.parentIds ?? []) {
      if (!peopleMap.has(pid)) continue;
      const found = visit(pid);
      if (found) return found;
    }
    path.pop();
    state.set(id, 2);
    return null;
  }

  for (const p of people) {
    const found = visit(p.id);
    if (found) return found;
  }
  return null;
}

// Validate the entire family tree for cycles
export function validateTree(people: Person[]): { valid: boolean; error?: string } {
  const cycle = findCycle(people);
  if (!cycle) return { valid: true };
  const names = cycle.map(id => people.find(p => p.id === id)?.name || id);
  return { valid: false, error: `Cycle detected: ${names.join(" → ")}` };
}
