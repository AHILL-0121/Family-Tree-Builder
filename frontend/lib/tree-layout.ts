import { Person, Position, LayoutNode } from "./types";

// Constants for layout
const NODE_RADIUS = 45;
const HORIZONTAL_SPACING = 180;
const VERTICAL_SPACING = 180;
const SPOUSE_SPACING = 100;
const CANVAS_PADDING = 100;

export interface LayoutResult {
  nodes: LayoutNode[];
  width: number;
  height: number;
}

// Build a map of children for each person
function buildChildrenMap(people: Person[]): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>();
  
  people.forEach(person => {
    childrenMap.set(person.id, []);
  });
  
  people.forEach(person => {
    person.parentIds.forEach(parentId => {
      const children = childrenMap.get(parentId);
      if (children && !children.includes(person.id)) {
        children.push(person.id);
      }
    });
  });
  
  return childrenMap;
}

// Find root nodes (people with no parents)
function findRoots(people: Person[]): Person[] {
  return people.filter(p => p.parentIds.length === 0);
}

// Calculate generation (depth) for each person
function calculateGenerations(people: Person[]): Map<string, number> {
  const generations = new Map<string, number>();
  const childrenMap = buildChildrenMap(people);
  const peopleMap = new Map(people.map(p => [p.id, p]));
  
  // BFS from roots
  const roots = findRoots(people);
  const queue: { id: string; gen: number }[] = roots.map(r => ({ id: r.id, gen: 0 }));
  
  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    
    if (!generations.has(id) || generations.get(id)! < gen) {
      generations.set(id, gen);
    }
    
    const children = childrenMap.get(id) || [];
    children.forEach(childId => {
      const currentGen = generations.get(childId);
      if (currentGen === undefined || currentGen < gen + 1) {
        queue.push({ id: childId, gen: gen + 1 });
      }
    });
  }
  
  // Handle disconnected nodes
  people.forEach(p => {
    if (!generations.has(p.id)) {
      generations.set(p.id, 0);
    }
  });
  
  return generations;
}

// Group people by generation
function groupByGeneration(people: Person[], generations: Map<string, number>): Map<number, Person[]> {
  const groups = new Map<number, Person[]>();
  
  people.forEach(person => {
    const gen = generations.get(person.id) || 0;
    if (!groups.has(gen)) {
      groups.set(gen, []);
    }
    groups.get(gen)!.push(person);
  });
  
  return groups;
}

// Check if two people are spouses
function areSpouses(person1: Person, person2: Person): boolean {
  return person1.spouseIds.includes(person2.id) || person2.spouseIds.includes(person1.id);
}

// Pyramid layout algorithm - positions parents centered above their children
export function computeLayout(people: Person[], autoAlign: boolean = false): LayoutResult {
  if (people.length === 0) {
    return { nodes: [], width: 800, height: 600 };
  }
  
  const generations = calculateGenerations(people);
  const generationGroups = groupByGeneration(people, generations);
  const maxGeneration = Math.max(...Array.from(generations.values()));
  const peopleMap = new Map(people.map(p => [p.id, p]));
  const childrenMap = buildChildrenMap(people);
  
  const nodes: LayoutNode[] = [];
  const positionedIds = new Set<string>();
  const nodePositions = new Map<string, Position>();
  
  // Build family units for each generation
  // A family unit is: couple with children, or single parent with children, or single person
  interface FamilyUnit {
    parents: Person[];  // 1 or 2 parents (couple)
    children: string[]; // child IDs
    id: string;         // unique identifier for the unit
  }
  
  // First, position the bottom-most generation (leaves)
  // Then work up, centering parents above their children
  
  // Step 1: Identify "family units" for each couple/parent group
  const familyUnits: FamilyUnit[] = [];
  const processedAsParent = new Set<string>();
  
  people.forEach(person => {
    if (processedAsParent.has(person.id)) return;
    
    // Check if this person is a parent
    const children = childrenMap.get(person.id) || [];
    if (children.length === 0) return;
    
    // Find spouse(s) who share children with this person
    const gen = generations.get(person.id) || 0;
    
    // Group children by their parent combination
    const childrenByParentPair = new Map<string, string[]>();
    
    children.forEach(childId => {
      const child = peopleMap.get(childId);
      if (!child) return;
      
      // Find the other parent
      const otherParentId = child.parentIds.find(pid => pid !== person.id);
      const pairKey = otherParentId 
        ? [person.id, otherParentId].sort().join('-')
        : person.id;
      
      if (!childrenByParentPair.has(pairKey)) {
        childrenByParentPair.set(pairKey, []);
      }
      childrenByParentPair.get(pairKey)!.push(childId);
    });
    
    // Create a family unit for each parent pair
    childrenByParentPair.forEach((childIds, pairKey) => {
      const parentIds = pairKey.split('-');
      const parents = parentIds.map(id => peopleMap.get(id)).filter(Boolean) as Person[];
      
      familyUnits.push({
        parents,
        children: childIds,
        id: pairKey
      });
      
      parents.forEach(p => processedAsParent.add(p.id));
    });
  });
  
  // Step 2: Position nodes from bottom to top (children first, then parents)
  // This ensures parents are centered above their children
  
  const UNIT_SPACING = 60; // Space between family units
  const CHILD_SPACING = HORIZONTAL_SPACING;
  const COUPLE_GAP = SPOUSE_SPACING;
  
  // First, position all leaf nodes (people with no children)
  const leafGeneration = maxGeneration;
  
  // Work from bottom generation to top
  for (let gen = maxGeneration; gen >= 0; gen--) {
    const genPeople = generationGroups.get(gen) || [];
    
    if (gen === maxGeneration) {
      // Bottom generation - position linearly with grouping by parents
      let currentX = CANVAS_PADDING;
      const y = CANVAS_PADDING + gen * VERTICAL_SPACING;
      
      // Group by parent couples
      const peopleByParents = new Map<string, Person[]>();
      const orphans: Person[] = [];
      
      genPeople.forEach(person => {
        if (person.parentIds.length === 0) {
          orphans.push(person);
        } else {
          const parentKey = person.parentIds.slice().sort().join('-');
          if (!peopleByParents.has(parentKey)) {
            peopleByParents.set(parentKey, []);
          }
          peopleByParents.get(parentKey)!.push(person);
        }
      });
      
      // Position children grouped by parents
      const allGroups = Array.from(peopleByParents.values());
      if (orphans.length > 0) {
        allGroups.push(orphans);
      }
      
      allGroups.forEach((group, groupIndex) => {
        // Sort siblings to keep spouses together
        const sorted = [...group].sort((a, b) => {
          // If they're spouses, keep together
          if (areSpouses(a, b)) return 0;
          return a.givenName.localeCompare(b.givenName);
        });
        
        sorted.forEach((person, personIndex) => {
          if (!positionedIds.has(person.id)) {
            const pos = { x: currentX, y };
            nodePositions.set(person.id, pos);
            positionedIds.add(person.id);
            currentX += CHILD_SPACING;
          }
        });
        
        // Add gap between sibling groups
        if (groupIndex < allGroups.length - 1) {
          currentX += UNIT_SPACING;
        }
      });
    } else {
      // Upper generations - center above children
      const y = CANVAS_PADDING + gen * VERTICAL_SPACING;
      
      // Find couples and singles in this generation
      const processedPairs = new Set<string>();
      const units: Person[][] = [];
      
      // First collect multi-spouse groups
      genPeople.forEach(person => {
        const spousesInGen = person.spouseIds.filter(spouseId => {
          const spouse = peopleMap.get(spouseId);
          return spouse && generations.get(spouseId) === gen;
        });
        
        if (spousesInGen.length > 1) {
          // Multi-spouse - add all couples together
          spousesInGen.forEach(spouseId => {
            const pairKey = [person.id, spouseId].sort().join('-');
            if (!processedPairs.has(pairKey)) {
              processedPairs.add(pairKey);
              const spouse = peopleMap.get(spouseId)!;
              units.push([person, spouse]);
            }
          });
        }
      });
      
      // Then single-spouse couples
      genPeople.forEach(person => {
        const spousesInGen = person.spouseIds.filter(spouseId => {
          const spouse = peopleMap.get(spouseId);
          return spouse && generations.get(spouseId) === gen;
        });
        
        if (spousesInGen.length === 1) {
          const spouseId = spousesInGen[0];
          const pairKey = [person.id, spouseId].sort().join('-');
          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            const spouse = peopleMap.get(spouseId)!;
            units.push([person, spouse]);
          }
        } else if (spousesInGen.length === 0) {
          // Single person
          const isInPair = Array.from(processedPairs).some(key => key.includes(person.id));
          if (!isInPair) {
            units.push([person]);
          }
        }
      });
      
      // Position each unit centered above its children
      units.forEach(unit => {
        // Find all children of this unit's members
        const unitChildIds = new Set<string>();
        unit.forEach(parent => {
          const parentChildren = childrenMap.get(parent.id) || [];
          parentChildren.forEach(cid => unitChildIds.add(cid));
        });
        
        // Calculate center X based on children positions
        let centerX: number;
        
        if (unitChildIds.size > 0) {
          // Get positions of children
          const childPositions = Array.from(unitChildIds)
            .map(cid => nodePositions.get(cid))
            .filter(Boolean) as Position[];
          
          if (childPositions.length > 0) {
            const minX = Math.min(...childPositions.map(p => p.x));
            const maxX = Math.max(...childPositions.map(p => p.x));
            centerX = (minX + maxX) / 2;
          } else {
            // Fallback: use a running X position
            centerX = CANVAS_PADDING + positionedIds.size * CHILD_SPACING;
          }
        } else {
          // No children - position at end
          const existingX = Array.from(nodePositions.values()).map(p => p.x);
          centerX = existingX.length > 0 
            ? Math.max(...existingX) + CHILD_SPACING 
            : CANVAS_PADDING;
        }
        
        // Position the unit members
        if (unit.length === 2) {
          // Couple - position side by side, centered
          const [p1, p2] = unit;
          const halfGap = COUPLE_GAP / 2;
          
          if (!positionedIds.has(p1.id)) {
            const pos1 = { x: centerX - halfGap, y };
            nodePositions.set(p1.id, pos1);
            positionedIds.add(p1.id);
          }
          
          if (!positionedIds.has(p2.id)) {
            const pos2 = { x: centerX + halfGap, y };
            nodePositions.set(p2.id, pos2);
            positionedIds.add(p2.id);
          }
        } else {
          // Single person
          const person = unit[0];
          if (!positionedIds.has(person.id)) {
            const pos = { x: centerX, y };
            nodePositions.set(person.id, pos);
            positionedIds.add(person.id);
          }
        }
      });
    }
  }
  
  // Create layout nodes
  people.forEach(person => {
    const pos = nodePositions.get(person.id);
    const gen = generations.get(person.id) || 0;
    
    if (pos) {
      nodes.push({
        ...person,
        computedPosition: (!autoAlign && person.position) ? person.position : pos,
        generation: gen
      });
    } else {
      // Fallback for any unpositioned nodes
      const fallbackPos = { x: CANVAS_PADDING, y: CANVAS_PADDING + gen * VERTICAL_SPACING };
      nodes.push({
        ...person,
        computedPosition: (!autoAlign && person.position) ? person.position : fallbackPos,
        generation: gen
      });
    }
  });
  
  // Normalize positions - shift everything to be positive with padding
  const allX = nodes.map(n => n.computedPosition.x);
  const minX = Math.min(...allX);
  if (minX < CANVAS_PADDING) {
    const shiftX = CANVAS_PADDING - minX;
    nodes.forEach(node => {
      node.computedPosition.x += shiftX;
    });
  }
  
  // Calculate canvas dimensions
  const maxX = Math.max(...nodes.map(n => n.computedPosition.x), 800) + CANVAS_PADDING;
  const maxY = Math.max(...nodes.map(n => n.computedPosition.y), 600) + CANVAS_PADDING;
  
  return {
    nodes,
    width: maxX,
    height: maxY
  };
}

// Auto-align function that returns new positions for all people
export function computeAutoAlignPositions(people: Person[]): Map<string, Position> {
  const layout = computeLayout(people, true);
  const positions = new Map<string, Position>();
  
  layout.nodes.forEach(node => {
    positions.set(node.id, node.computedPosition);
  });
  
  return positions;
}

// Generate SVG path for parent-child connection (curved Bézier)
export function generateConnectionPath(
  parentPos: Position,
  childPos: Position
): string {
  const startX = parentPos.x;
  const startY = parentPos.y + NODE_RADIUS;
  const endX = childPos.x;
  const endY = childPos.y - NODE_RADIUS;
  
  const midY = (startY + endY) / 2;
  
  return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
}

// Generate SVG path for spouse connection (horizontal line)
export function generateSpousePath(
  pos1: Position,
  pos2: Position
): string {
  const y = pos1.y;
  const startX = Math.min(pos1.x, pos2.x) + NODE_RADIUS;
  const endX = Math.max(pos1.x, pos2.x) - NODE_RADIUS;
  
  return `M ${startX} ${y} L ${endX} ${y}`;
}

export { NODE_RADIUS };
