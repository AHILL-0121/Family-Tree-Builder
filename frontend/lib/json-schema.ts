import { FamilyTreeData, Person, createEmptyPerson } from "./types";

const CURRENT_VERSION = 3;

// Validate JSON structure
export function validateFamilyTreeJson(data: unknown): { valid: boolean; error?: string; data?: FamilyTreeData } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid JSON structure' };
  }
  
  const json = data as Record<string, unknown>;
  
  // Check version
  if (typeof json.version !== 'number') {
    return { valid: false, error: 'Missing or invalid version field' };
  }
  
  // Check people array
  if (!Array.isArray(json.people)) {
    return { valid: false, error: 'Missing or invalid people array' };
  }
  
  // Validate each person
  const people = json.people as unknown[];
  const migratedPeople: Person[] = [];
  
  for (let i = 0; i < people.length; i++) {
    const person = people[i] as Record<string, unknown>;
    
    if (!person || typeof person !== 'object') {
      return { valid: false, error: `Invalid person at index ${i}` };
    }
    
    if (typeof person.id !== 'string') {
      return { valid: false, error: `Missing or invalid id for person at index ${i}` };
    }
    
    if (!Array.isArray(person.parentIds)) {
      return { valid: false, error: `Missing or invalid parentIds for person at index ${i}` };
    }
    
    if (!Array.isArray(person.spouseIds)) {
      return { valid: false, error: `Missing or invalid spouseIds for person at index ${i}` };
    }
    
    // Migrate old format to new format
    const emptyPerson = createEmptyPerson(person.id as string);
    const migratedPerson: Person = {
      ...emptyPerson,
      id: person.id as string,
      name: (person.name as string) || "",
      givenName: (person.givenName as string) || "",
      surname: (person.surname as string) || "",
      gender: (person.gender as Person["gender"]) || "",
      occupation: (person.occupation as string) || "",
      notes: (person.notes as string) || "",
      birth: (person.birth as Person["birth"]) || { date: "", place: "" },
      death: (person.death as Person["death"]) || null,
      parentIds: person.parentIds as string[],
      spouseIds: person.spouseIds as string[],
      childIds: (person.childIds as string[]) || [],
      marriages: (person.marriages as Person["marriages"]) || [],
      avatarUrl: (person.avatarUrl as string) || null,
      position: (person.position as Person["position"]) || null,
    };
    
    migratedPeople.push(migratedPerson);
  }
  
  return {
    valid: true,
    data: {
      version: json.version as number,
      people: migratedPeople
    }
  };
}

// Create export data
export function createExportData(people: Person[]): FamilyTreeData {
  return {
    version: CURRENT_VERSION,
    people: people.map(p => ({
      id: p.id,
      name: p.name,
      givenName: p.givenName,
      surname: p.surname,
      gender: p.gender,
      occupation: p.occupation,
      notes: p.notes,
      birth: p.birth ? { ...p.birth } : { date: "", place: "" },
      death: p.death ? { ...p.death } : null,
      parentIds: [...p.parentIds],
      spouseIds: [...p.spouseIds],
      childIds: [...(p.childIds || [])],
      marriages: (p.marriages || []).map(m => ({ ...m })),
      avatarUrl: p.avatarUrl,
      position: p.position ? { ...p.position } : null
    }))
  };
}

// Generate unique ID
export function generateId(): string {
  return `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
