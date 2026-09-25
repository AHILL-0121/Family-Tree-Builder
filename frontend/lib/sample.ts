import { Person, createEmptyPerson } from "./types";
import { normalize } from "./graph";

// "Explore a sample" family: three generations, two families, enough to show Tamil kinship terms.
type Row = [id: string, given: string, gender: Person["gender"], born: string, died: string, place: string, occupation: string, parents: string[], spouse?: [string, string]];

const rows: Row[] = [
  ["arul", "Arulmozhi", "male", "1936", "2012", "Thanjavur", "Schoolteacher", [], ["meena", "1959"]],
  ["meena", "Meenakshi", "female", "1941", "", "Kumbakonam", "", []],
  ["kamala", "Kamala", "female", "1962", "", "Thanjavur", "Bank officer", ["arul", "meena"], ["raja", "1984"]],
  ["raja", "Rajasekar", "male", "1958", "", "Madurai", "Civil engineer", []],
  ["sundar", "Sundar", "male", "1966", "", "Thanjavur", "Pharmacist", ["arul", "meena"], ["lakshmi", "1995"]],
  ["lakshmi", "Lakshmi", "female", "1970", "", "Tiruchirappalli", "", ["nata", "saras"]],
  ["ashwin", "Ashwin", "male", "1987", "", "Chennai", "Software developer", ["kamala", "raja"]],
  ["nandhini", "Nandhini", "female", "1990", "", "Chennai", "Doctor", ["kamala", "raja"]],
  ["vishal", "Vishal", "male", "1998", "", "Coimbatore", "Student", ["sundar", "lakshmi"]],
  ["nata", "Natarajan", "male", "1935", "2019", "Tiruchirappalli", "Farmer", [], ["saras", "1963"]],
  ["saras", "Saraswathi", "female", "1944", "", "Tiruchirappalli", "", []],
  ["gopal", "Gopal", "male", "1967", "", "Tiruchirappalli", "Shopkeeper", ["nata", "saras"]],
];

export const SAMPLE_NAME = "Arulmozhi family";

export function samplePeople(): Person[] {
  const people = rows.map(([id, given, gender, born, died, place, occupation, parents, spouse]) => {
    const p = createEmptyPerson(`sample-${id}`);
    p.givenName = given;
    p.name = given;
    p.gender = gender;
    p.birth = { date: born, place };
    p.death = died ? { date: died, place: "" } : null;
    p.occupation = occupation;
    p.parentIds = parents.map((q) => `sample-${q}`);
    if (spouse) {
      p.spouseIds = [`sample-${spouse[0]}`];
      p.marriages = [{ spouseId: `sample-${spouse[0]}`, date: spouse[1], place: "", divorced: false, divorceDate: "", divorcePlace: "" }];
    }
    if (id === "arul") p.notes = "Taught Tamil at the Kumbakonam boys' school for thirty-one years. Kept every letter his children ever sent.";
    return p;
  });
  return normalize(people).people;
}
