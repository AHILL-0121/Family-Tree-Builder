import { Person } from "./types";

// Detect if adding a parent would create a cycle
export function wouldCreateCycle(
  people: Person[],
  childId: string,
  potentialParentId: string
): boolean {
  // A person cannot be their own parent
  if (childId === potentialParentId) return true;
  
  const peopleMap = new Map(people.map(p => [p.id, p]));
  
  // Check if potentialParent is a descendant of child
  // If so, making potentialParent a parent of child would create a cycle
  const visited = new Set<string>();
  const queue = [childId];
  
  // Build children map
  const childrenMap = new Map<string, string[]>();
  people.forEach(person => {
    childrenMap.set(person.id, []);
  });
  people.forEach(person => {
    person.parentIds.forEach(parentId => {
      const children = childrenMap.get(parentId);
      if (children) {
        children.push(person.id);
      }
    });
  });
  
  // BFS to find all descendants of child
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    const children = childrenMap.get(currentId) || [];
    children.forEach(descendantId => {
      if (descendantId === potentialParentId) {
        return true; // Found cycle
      }
      queue.push(descendantId);
    });
  }
  
  // Also check if child is an ancestor of potentialParent
  const ancestorVisited = new Set<string>();
  const ancestorQueue = [potentialParentId];
  
  while (ancestorQueue.length > 0) {
    const currentId = ancestorQueue.shift()!;
    if (ancestorVisited.has(currentId)) continue;
    ancestorVisited.add(currentId);
    
    if (currentId === childId) {
      return true; // Child is an ancestor of potential parent - would create cycle
    }
    
    const person = peopleMap.get(currentId);
    if (person) {
      person.parentIds.forEach(parentId => {
        ancestorQueue.push(parentId);
      });
    }
  }
  
  return false;
}

// Validate the entire family tree for cycles
export function validateTree(people: Person[]): { valid: boolean; error?: string } {
  for (const person of people) {
    for (const parentId of person.parentIds) {
      if (wouldCreateCycle(people.filter(p => p.id !== person.id || !p.parentIds.includes(parentId)), person.id, parentId)) {
        return {
          valid: false,
          error: `Cycle detected: ${person.name} cannot have this parent relationship`
        };
      }
    }
  }
  
  return { valid: true };
}
