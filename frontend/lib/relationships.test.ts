import { describe, expect, it } from "vitest";
import { findRelationship, relationshipSentence, shortestPath } from "./relationships";
import { normalize } from "./graph";
import { createEmptyPerson, Person } from "./types";

// A three-family fixture that exercises every rule in tamilrelations.txt that the engine knows.
type G = Person["gender"];
const spec: [id: string, gender: G, born: string, parents: string[], spouses?: string[]][] = [
  ["kali", "male", "1910", []],
  ["arul", "male", "1936", ["kali"], ["meena"]],
  ["meena", "female", "1941", []],
  ["murugan", "male", "1960", ["arul", "meena"], ["selvi"]],
  ["selvi", "female", "1963", []],
  ["kamala", "female", "1962", ["arul", "meena"], ["raja"]],
  ["raja", "male", "1958", [], ["kamala"]],
  ["sundar", "male", "1966", ["arul", "meena"], ["lakshmi"]],
  ["mohan", "male", "1968", ["arul", "meena"], ["revathi"]],
  ["revathi", "female", "1971", []],
  ["nata", "male", "1935", [], ["saras"]],
  ["saras", "female", "1944", []],
  ["gopal", "male", "1967", ["nata", "saras"], ["geetha"]],
  ["geetha", "female", "1972", []],
  ["lakshmi", "female", "1970", ["nata", "saras"]],
  ["uma", "female", "1975", ["nata", "saras"], ["ravi"]],
  ["ravi", "male", "1970", []],
  ["arun", "male", "1982", ["raja"]], // Rajasekar's son from an earlier marriage
  ["ashwin", "male", "1987", ["kamala", "raja"]],
  ["nandhini", "female", "1990", ["kamala", "raja"]],
  ["karthik", "male", "1995", ["gopal", "geetha"]],
  ["priya", "female", "1996", ["mohan", "revathi"]],
  ["vishal", "male", "1998", ["sundar", "lakshmi"]],
  ["bala", "male", "", ["sundar", "lakshmi"]], // no birth year
  ["divya", "female", "2000", ["uma", "ravi"]],
  ["stranger", "", "1980", []],
];
const people = normalize(
  spec.map(([id, gender, born, parentIds, spouseIds = []]) => ({
    ...createEmptyPerson(id), name: id, givenName: id, gender, birth: { date: born, place: "" }, parentIds, spouseIds,
  }))
).people;
const P = (id: string) => people.find((p) => p.id === id)!;
const rel = (a: string, b: string) => findRelationship(people, P(a), P(b));

// [asker, about, english, tamil, address?]
const golden: [string, string, string, string, string?][] = [
  // Vishal (male, 1998) asking
  ["vishal", "sundar", "father", "அப்பா"],
  ["vishal", "lakshmi", "mother", "அம்மா"],
  ["vishal", "arul", "paternal grandfather", "தாத்தா"],
  ["vishal", "meena", "paternal grandmother", "பாட்டி"],
  ["vishal", "nata", "maternal grandfather", "தாத்தா"],
  ["vishal", "saras", "maternal grandmother", "பாட்டி"],
  ["vishal", "kali", "great-grandfather", "கொள்ளுத் தாத்தா"],
  ["vishal", "kamala", "paternal aunt", "அத்தை"],
  ["vishal", "raja", "uncle by marriage", "மாமா"],
  ["vishal", "murugan", "paternal uncle", "பெரியப்பா"],
  ["vishal", "mohan", "paternal uncle", "சித்தப்பா"],
  ["vishal", "selvi", "aunt by marriage", "பெரியம்மா"],
  ["vishal", "revathi", "aunt by marriage", "சித்தி"],
  ["vishal", "gopal", "maternal uncle", "மாமா"],
  ["vishal", "geetha", "aunt by marriage", "அத்தை", "மாமி"],
  ["vishal", "uma", "maternal aunt", "சித்தி"],
  ["vishal", "ravi", "uncle by marriage", "சித்தப்பா"],
  ["vishal", "ashwin", "cousin", "அத்தை மகன்", "அத்தான்"],
  ["vishal", "nandhini", "cousin", "அத்தை மகள்", "முறைப்பெண்"],
  ["vishal", "karthik", "cousin", "மாமன் மகன்", "அத்தான்"],
  ["vishal", "priya", "cousin", "அக்கா"],
  ["vishal", "divya", "cousin", "தங்கை"],
  ["vishal", "bala", "brother", "அண்ணன் / தம்பி"],
  // Ashwin (male, 1987)
  ["ashwin", "nandhini", "younger sister", "தங்கை"],
  ["ashwin", "arun", "elder half-brother", "அண்ணன்"],
  ["ashwin", "vishal", "cousin", "மாமன் மகன்", "மச்சான்"],
  ["ashwin", "sundar", "maternal uncle", "மாமா"],
  ["ashwin", "lakshmi", "aunt by marriage", "அத்தை", "மாமி"],
  ["ashwin", "raja", "father", "அப்பா"],
  // Nandhini (female, 1990)
  ["nandhini", "ashwin", "elder brother", "அண்ணன்"],
  ["nandhini", "vishal", "cousin", "மாமன் மகன்", "மச்சான்"],
  // Kamala (female, 1962)
  ["kamala", "raja", "husband", "கணவர்"],
  ["kamala", "sundar", "younger brother", "தம்பி"],
  ["kamala", "murugan", "elder brother", "அண்ணன்"],
  ["kamala", "lakshmi", "sister-in-law", "தம்பி மனைவி"],
  ["kamala", "vishal", "nephew", "மருமகன்"],
  ["kamala", "ashwin", "son", "மகன்"],
  // Sundar (male, 1966)
  ["sundar", "kamala", "elder sister", "அக்கா"],
  ["sundar", "raja", "brother-in-law", "அத்தான்"],
  ["sundar", "lakshmi", "wife", "மனைவி"],
  ["sundar", "nata", "father-in-law", "மாமனார்"],
  ["sundar", "saras", "mother-in-law", "மாமியார்"],
  ["sundar", "gopal", "brother-in-law", "மச்சான்"],
  ["sundar", "uma", "sister-in-law", "கொழுந்தியாள்"],
  ["sundar", "ravi", "co-brother", "சகலை"],
  ["sundar", "ashwin", "nephew", "மருமகன்"],
  ["sundar", "priya", "niece", "மகள்"],
  // Lakshmi (female, 1970)
  ["lakshmi", "kamala", "sister-in-law", "நாத்தனார்"],
  ["lakshmi", "revathi", "co-sister", "ஓரகத்தி"],
  ["lakshmi", "murugan", "brother-in-law", "மச்சான்"],
  ["lakshmi", "mohan", "brother-in-law", "கொழுந்தன்"],
  ["lakshmi", "divya", "niece", "மகள்"],
  ["lakshmi", "karthik", "nephew", "மருமகன்"],
  // Elders
  ["arul", "vishal", "grandson", "பேரன்"],
  ["arul", "nandhini", "granddaughter", "பேத்தி"],
  ["arul", "raja", "son-in-law", "மருமகன்"],
  ["arul", "lakshmi", "daughter-in-law", "மருமகள்"],
  ["nata", "arul", "child's parent-in-law", "சம்பந்தி"],
  ["kali", "vishal", "great-grandson", "கொள்ளுப்பேரன்"],
];

describe("findRelationship golden table", () => {
  it.each(golden)("%s → %s is %s (%s)", (a, b, english, tamil, address) => {
    const r = rel(a, b);
    expect(r.english).toBe(english);
    expect(r.tamil).toBe(tamil);
    if (address) expect(r.address).toBe(address);
  });

  it("covers at least 40 relationships", () => {
    expect(golden.length).toBeGreaterThanOrEqual(40);
  });
});

describe("edge cases", () => {
  it("explains missing birth years", () => {
    expect(rel("vishal", "bala").note).toMatch(/birth years/);
  });
  it("uses full birth dates to tell elder from younger within the same year", () => {
    const kids = (a: string, b: string) => normalize([
      { ...createEmptyPerson("dad"), name: "dad", gender: "male" as const },
      { ...createEmptyPerson("x"), name: "x", gender: "male" as const, birth: { date: a, place: "" }, parentIds: ["dad"] },
      { ...createEmptyPerson("y"), name: "y", gender: "male" as const, birth: { date: b, place: "" }, parentIds: ["dad"] },
    ]).people;
    const between = (a: string, b: string) => { const ps = kids(a, b); return findRelationship(ps, ps[2], ps[1]); };
    expect(between("1990-01-15", "1990-11-02").tamil).toBe("அண்ணன்"); // x born first: y's elder brother
    expect(between("1990-11-02", "1990-01-15").tamil).toBe("தம்பி");
    expect(between("1990", "1990-11-02").tamil).toBe("அண்ணன் / தம்பி"); // only a year: can't tell
  });
  it("same person and not connected", () => {
    expect(rel("vishal", "vishal").english).toBe("Same person");
    const none = rel("vishal", "stranger");
    expect(none.related).toBe(false);
    expect(relationshipSentence(none, "Vishal", "Stranger")).toBe("Stranger and Vishal aren't connected in this tree yet.");
  });
  it("writes a readable sentence", () => {
    expect(relationshipSentence(rel("vishal", "gopal"), "Vishal", "Gopal")).toBe("Gopal is Vishal's maternal uncle (mother's brother).");
  });
  it("finds the SHORTEST path (BFS), not the first one DFS stumbles on", () => {
    expect(shortestPath(people, "vishal", "gopal")).toHaveLength(3); // mother, her father, his son
    expect(rel("vishal", "gopal").path).toEqual(["vishal", "lakshmi", "nata", "gopal"]);
  });
  it("stays fast on a large, densely married tree", () => {
    const big: Person[] = [];
    for (let i = 0; i < 400; i++) {
      big.push({ ...createEmptyPerson(`p${i}`), gender: i % 2 ? "female" : "male", parentIds: i > 1 ? [`p${Math.floor(i / 2) - 1}`, `p${Math.floor(i / 2)}`] : [], spouseIds: i % 2 ? [`p${i - 1}`] : [] });
    }
    const norm = normalize(big).people;
    const t = performance.now();
    findRelationship(norm, norm[0], norm[399]);
    expect(performance.now() - t).toBeLessThan(200);
  });
});
