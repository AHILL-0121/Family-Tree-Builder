// Types for the Family Tree application

export interface Position {
  x: number;
  y: number;
}

export interface EventDetails {
  date: string;
  place: string;
}

export interface Person {
  id: string;
  // Personal Details
  name: string;
  givenName: string;
  surname: string;
  gender: "male" | "female" | "other" | "";
  occupation: string;
  notes: string;
  
  // Life Events
  birth: EventDetails;
  death: EventDetails | null;
  
  // Relationships
  parentIds: string[];
  spouseIds: string[];
  childIds: string[];
  
  // Marriage details (stored with spouse reference)
  marriages: Marriage[];
  
  // Media
  avatarUrl: string | null;
  
  // Layout
  position: Position | null;
}

export interface Marriage {
  spouseId: string;
  date: string;
  place: string;
  divorced: boolean;
  divorceDate: string;
  divorcePlace: string;
}

export interface FamilyTreeData {
  version: number;
  people: Person[];
}

export interface LayoutNode extends Person {
  computedPosition: Position;
  generation: number;
}

// Helper to create empty person
export function createEmptyPerson(id: string): Person {
  return {
    id,
    name: "",
    givenName: "",
    surname: "",
    gender: "",
    occupation: "",
    notes: "",
    birth: { date: "", place: "" },
    death: null,
    parentIds: [],
    spouseIds: [],
    childIds: [],
    marriages: [],
    avatarUrl: null,
    position: null,
  };
}

// Helper to get full name from given name and surname
export function getFullName(person: Person): string {
  if (person.name) return person.name;
  const parts = [person.givenName, person.surname].filter(Boolean);
  return parts.join(" ") || "Unknown";
}
