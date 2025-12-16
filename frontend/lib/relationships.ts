import { Person } from "./types";

export interface RelationshipResult {
  english: string;
  tamil: string;
  path: string[];
}

// Find the relationship path between two people
function findPath(
  people: Person[],
  fromId: string,
  toId: string,
  visited: Set<string> = new Set(),
  path: string[] = []
): string[] | null {
  if (fromId === toId) return [...path, fromId];
  if (visited.has(fromId)) return null;

  visited.add(fromId);
  const current = people.find(p => p.id === fromId);
  if (!current) return null;

  const currentPath = [...path, fromId];

  // Check parents
  for (const parentId of current.parentIds) {
    const result = findPath(people, parentId, toId, new Set(visited), currentPath);
    if (result) return result;
  }

  // Check children
  for (const childId of current.childIds) {
    const result = findPath(people, childId, toId, new Set(visited), currentPath);
    if (result) return result;
  }

  // Check spouses
  for (const spouseId of current.spouseIds) {
    const result = findPath(people, spouseId, toId, new Set(visited), currentPath);
    if (result) return result;
  }

  return null;
}

// Calculate generations between two people (positive = descendant, negative = ancestor)
function getGenerationDiff(people: Person[], fromId: string, toId: string, path: string[]): number {
  let genDiff = 0;
  
  for (let i = 0; i < path.length - 1; i++) {
    const current = people.find(p => p.id === path[i]);
    const next = people.find(p => p.id === path[i + 1]);
    if (!current || !next) continue;

    if (current.parentIds.includes(next.id)) {
      genDiff--; // Going up to parent
    } else if (current.childIds.includes(next.id)) {
      genDiff++; // Going down to child
    }
    // Spouse is same generation (genDiff += 0)
  }
  
  return genDiff;
}

// Check if path goes through spouse
function goesThoughSpouse(people: Person[], path: string[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const current = people.find(p => p.id === path[i]);
    const next = people.find(p => p.id === path[i + 1]);
    if (!current || !next) continue;
    
    if (current.spouseIds.includes(next.id)) {
      return true;
    }
  }
  return false;
}

// Determine detailed relationship
export function findRelationship(
  people: Person[],
  person1: Person,
  person2: Person
): RelationshipResult {
  if (person1.id === person2.id) {
    return { english: "Same Person", tamil: "ஒரே நபர்", path: [person1.id] };
  }

  const path = findPath(people, person1.id, person2.id);
  if (!path) {
    return { english: "No direct relationship found", tamil: "நேரடி உறவு இல்லை", path: [] };
  }

  const person1Data = person1;
  const person2Data = person2;
  const person1Gender = person1Data.gender;
  const person2Gender = person2Data.gender;

  // Direct relationships
  // Spouse
  if (person1.spouseIds.includes(person2.id)) {
    if (person2Gender === "male") {
      return { english: "Husband", tamil: "கணவர்", path };
    } else if (person2Gender === "female") {
      return { english: "Wife", tamil: "மனைவி", path };
    }
    return { english: "Spouse", tamil: "கணவன் / மனைவி", path };
  }

  // Parent
  if (person1.parentIds.includes(person2.id)) {
    if (person2Gender === "male") {
      return { english: "Father", tamil: "அப்பா", path };
    } else if (person2Gender === "female") {
      return { english: "Mother", tamil: "அம்மா", path };
    }
    return { english: "Parent", tamil: "பெற்றோர்", path };
  }

  // Child
  if (person1.childIds.includes(person2.id)) {
    if (person2Gender === "male") {
      return { english: "Son", tamil: "மகன்", path };
    } else if (person2Gender === "female") {
      return { english: "Daughter", tamil: "மகள்", path };
    }
    return { english: "Child", tamil: "குழந்தை", path };
  }

  // Sibling (share at least one parent)
  const sharedParents = person1.parentIds.filter(pid => person2.parentIds.includes(pid));
  if (sharedParents.length > 0) {
    if (person2Gender === "male") {
      return { english: "Brother", tamil: "சகோதரன்", path };
    } else if (person2Gender === "female") {
      return { english: "Sister", tamil: "சகோதரி", path };
    }
    return { english: "Sibling", tamil: "உடன்பிறந்தவர்", path };
  }

  // Grandparent (parent's parent)
  for (const parentId of person1.parentIds) {
    const parent = people.find(p => p.id === parentId);
    if (parent && parent.parentIds.includes(person2.id)) {
      if (person2Gender === "male") {
        return { english: "Grandfather", tamil: "தாத்தா", path };
      } else if (person2Gender === "female") {
        return { english: "Grandmother", tamil: "பாட்டி", path };
      }
      return { english: "Grandparent", tamil: "பாட்டி/தாத்தா", path };
    }
  }

  // Grandchild (child's child)
  for (const childId of person1.childIds) {
    const child = people.find(p => p.id === childId);
    if (child && child.childIds.includes(person2.id)) {
      if (person2Gender === "male") {
        return { english: "Grandson", tamil: "பேரன்", path };
      } else if (person2Gender === "female") {
        return { english: "Granddaughter", tamil: "பேத்தி", path };
      }
      return { english: "Grandchild", tamil: "பேரக்குழந்தை", path };
    }
  }

  // Great-grandparent
  for (const parentId of person1.parentIds) {
    const parent = people.find(p => p.id === parentId);
    if (!parent) continue;
    for (const gpId of parent.parentIds) {
      const gp = people.find(p => p.id === gpId);
      if (gp && gp.parentIds.includes(person2.id)) {
        if (person2Gender === "male") {
          return { english: "Great Grandfather", tamil: "கொள்ளுத் தாத்தா", path };
        } else if (person2Gender === "female") {
          return { english: "Great Grandmother", tamil: "கொள்ளுப் பாட்டி", path };
        }
        return { english: "Great Grandparent", tamil: "கொள்ளுத் தாத்தா/பாட்டி", path };
      }
    }
  }

  // Great-grandchild
  for (const childId of person1.childIds) {
    const child = people.find(p => p.id === childId);
    if (!child) continue;
    for (const gcId of child.childIds) {
      const gc = people.find(p => p.id === gcId);
      if (gc && gc.childIds.includes(person2.id)) {
        if (person2Gender === "male") {
          return { english: "Great Grandson", tamil: "கொள்ளுப்பேரன்", path };
        } else if (person2Gender === "female") {
          return { english: "Great Granddaughter", tamil: "கொள்ளுப்பேத்தி", path };
        }
        return { english: "Great Grandchild", tamil: "கொள்ளுப்பேரக்குழந்தை", path };
      }
    }
  }

  // Uncle/Aunt (parent's sibling)
  for (const parentId of person1.parentIds) {
    const parent = people.find(p => p.id === parentId);
    if (!parent) continue;
    
    // Check if person2 is a sibling of the parent
    const parentSiblings = people.filter(p => 
      p.id !== parentId &&
      p.parentIds.some(pid => parent.parentIds.includes(pid))
    );
    
    if (parentSiblings.some(s => s.id === person2.id)) {
      // Determine maternal or paternal
      const parentGender = parent.gender;
      
      if (person2Gender === "male") {
        if (parentGender === "female") {
          return { english: "Maternal Uncle", tamil: "மாமா (தாய் மாமா)", path };
        } else {
          return { english: "Paternal Uncle", tamil: "சித்தப்பா / பெரியப்பா", path };
        }
      } else if (person2Gender === "female") {
        if (parentGender === "female") {
          return { english: "Maternal Aunt", tamil: "சித்தி / பெரியம்மா", path };
        } else {
          return { english: "Paternal Aunt", tamil: "அத்தை", path };
        }
      }
      return { english: "Uncle/Aunt", tamil: "மாமா/அத்தை", path };
    }
    
    // Check if person2 is spouse of parent's sibling
    for (const sibling of parentSiblings) {
      if (sibling.spouseIds.includes(person2.id)) {
        const parentGender = parent.gender;
        if (person2Gender === "male") {
          if (parentGender === "female") {
            return { english: "Uncle (by marriage)", tamil: "மாமா", path };
          }
          return { english: "Uncle (by marriage)", tamil: "சித்தப்பா / பெரியப்பா", path };
        } else {
          if (parentGender === "male") {
            return { english: "Aunt (by marriage)", tamil: "மாமி", path };
          }
          return { english: "Aunt (by marriage)", tamil: "சித்தி / பெரியம்மா", path };
        }
      }
    }
  }

  // Nephew/Niece (sibling's child)
  const siblings = people.filter(p => 
    p.id !== person1.id &&
    p.parentIds.some(pid => person1.parentIds.includes(pid))
  );
  
  for (const sibling of siblings) {
    if (sibling.childIds.includes(person2.id)) {
      if (person2Gender === "male") {
        return { english: "Nephew", tamil: "மருமகன் (சகோதரன்/சகோதரியின் மகன்)", path };
      } else if (person2Gender === "female") {
        return { english: "Niece", tamil: "மருமகள் (சகோதரன்/சகோதரியின் மகள்)", path };
      }
      return { english: "Nephew/Niece", tamil: "மருமகன்/மருமகள்", path };
    }
  }

  // Cousin (parent's sibling's child)
  for (const parentId of person1.parentIds) {
    const parent = people.find(p => p.id === parentId);
    if (!parent) continue;
    
    const parentSiblings = people.filter(p => 
      p.id !== parentId &&
      p.parentIds.some(pid => parent.parentIds.includes(pid))
    );
    
    for (const uncle of parentSiblings) {
      if (uncle.childIds.includes(person2.id)) {
        if (person2Gender === "male") {
          return { english: "Cousin Brother", tamil: "மாமா/அத்தை மகன் (உறவு சகோதரன்)", path };
        } else if (person2Gender === "female") {
          return { english: "Cousin Sister", tamil: "மாமா/அத்தை மகள் (உறவு சகோதரி)", path };
        }
        return { english: "Cousin", tamil: "உறவினர்", path };
      }
    }
  }

  // In-laws
  // Father-in-law / Mother-in-law (spouse's parent)
  for (const spouseId of person1.spouseIds) {
    const spouse = people.find(p => p.id === spouseId);
    if (spouse && spouse.parentIds.includes(person2.id)) {
      if (person2Gender === "male") {
        return { english: "Father-in-law", tamil: "மாமனார்", path };
      } else if (person2Gender === "female") {
        return { english: "Mother-in-law", tamil: "மாமியார்", path };
      }
      return { english: "Parent-in-law", tamil: "மாமனார்/மாமியார்", path };
    }
  }

  // Son-in-law / Daughter-in-law (child's spouse)
  for (const childId of person1.childIds) {
    const child = people.find(p => p.id === childId);
    if (child && child.spouseIds.includes(person2.id)) {
      if (person2Gender === "male") {
        return { english: "Son-in-law", tamil: "மருமகன்", path };
      } else if (person2Gender === "female") {
        return { english: "Daughter-in-law", tamil: "மருமகள்", path };
      }
      return { english: "Child-in-law", tamil: "மருமகன்/மருமகள்", path };
    }
  }

  // Brother-in-law / Sister-in-law (spouse's sibling)
  for (const spouseId of person1.spouseIds) {
    const spouse = people.find(p => p.id === spouseId);
    if (!spouse) continue;
    
    const spouseSiblings = people.filter(p => 
      p.id !== spouseId &&
      p.parentIds.some(pid => spouse.parentIds.includes(pid))
    );
    
    if (spouseSiblings.some(s => s.id === person2.id)) {
      if (person2Gender === "male") {
        return { english: "Brother-in-law", tamil: "மைத்துனர் / மச்சான்", path };
      } else if (person2Gender === "female") {
        return { english: "Sister-in-law", tamil: "நாத்தனார் / மைத்துனி", path };
      }
      return { english: "Sibling-in-law", tamil: "மைத்துனர்/நாத்தனார்", path };
    }
  }

  // Brother-in-law / Sister-in-law (sibling's spouse)
  for (const sibling of siblings) {
    if (sibling.spouseIds.includes(person2.id)) {
      if (person1Gender === "male") {
        // I'm male
        if (person2Gender === "male") {
          return { english: "Brother-in-law", tamil: "மச்சான் / அத்தான்", path };
        } else {
          return { english: "Sister-in-law", tamil: "அண்ணி / மைத்துனி", path };
        }
      } else {
        // I'm female
        if (person2Gender === "male") {
          return { english: "Brother-in-law", tamil: "அத்தான் / மச்சான்", path };
        } else {
          return { english: "Sister-in-law", tamil: "அண்ணி", path };
        }
      }
    }
  }

  // Co-brother / Co-sister (spouse's sibling's spouse)
  for (const spouseId of person1.spouseIds) {
    const spouse = people.find(p => p.id === spouseId);
    if (!spouse) continue;
    
    const spouseSiblings = people.filter(p => 
      p.id !== spouseId &&
      p.parentIds.some(pid => spouse.parentIds.includes(pid))
    );
    
    for (const spouseSibling of spouseSiblings) {
      if (spouseSibling.spouseIds.includes(person2.id)) {
        if (person2Gender === "male") {
          return { english: "Co-Brother", tamil: "சகலை", path };
        } else if (person2Gender === "female") {
          return { english: "Co-Sister", tamil: "ஓரகத்தி", path };
        }
      }
    }
  }

  // Generic fallback based on generation difference
  const genDiff = getGenerationDiff(people, person1.id, person2.id, path);
  const throughSpouse = goesThoughSpouse(people, path);

  if (genDiff < -2) {
    return { english: `Ancestor (${Math.abs(genDiff)} generations)`, tamil: `மூதாதையர் (${Math.abs(genDiff)} தலைமுறை)`, path };
  } else if (genDiff > 2) {
    return { english: `Descendant (${genDiff} generations)`, tamil: `வழித்தோன்றல் (${genDiff} தலைமுறை)`, path };
  } else if (throughSpouse) {
    return { english: "Relative by marriage", tamil: "திருமண உறவினர்", path };
  }

  return { english: "Relative", tamil: "உறவினர்", path };
}
