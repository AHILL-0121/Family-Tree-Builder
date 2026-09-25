import { Person } from "./types";
import { compareDates } from "./dates";

// How person B is related to person A ("B is A's …").
//
// 1. Find the SHORTEST chain of parent / child / spouse links (BFS, O(people + links)).
// 2. Spell it as a kinship signature: F M P (father, mother, parent), S D C (son, daughter,
//    child), H W E (husband, wife, spouse), B Z G (brother, sister, sibling — an "up then down"
//    through a shared parent). Example: mother's brother's son = "MBS".
// 3. Look the signature up. Tamil terms also depend on who is asking (speaker gender) and on
//    relative age (elder/younger), so those are resolved from genders and birth years.
//
// Regional policy: the primary term is the common usage across central / Kongu Tamil Nadu,
// matching tamilrelations.txt. Where families commonly differ, `note` names the alternatives.

export interface RelationshipStep {
  letter: string; // kinship letter reached at this step
  id: string; // person reached
}

export interface RelationshipResult {
  english: string;
  tamil: string;
  path: string[]; // person ids from A to B (inclusive)
  /** Tamil form of address, when it differs from the descriptive term (e.g. cross cousins) */
  address?: string;
  /** Short explanation: regional variants, why a term was chosen, what data is missing */
  note?: string;
  /** Plain-English chain, e.g. "mother's brother's son" */
  gloss: string;
  /** Kinship signature, e.g. "MBS" */
  signature: string;
  steps: RelationshipStep[];
  related: boolean;
}

const WORD: Record<string, string> = {
  F: "father", M: "mother", P: "parent", S: "son", D: "daughter", C: "child",
  H: "husband", W: "wife", E: "spouse", B: "brother", Z: "sister", G: "sibling",
};

const AGE_NOTE = "Add both birth years to tell elder from younger; Tamil uses a different word for each.";
const PARALLEL =
  "A parallel cousin (father's brother's or mother's sister's child). In Tamil kinship parallel cousins are brothers and sisters, and are addressed that way.";
const CROSS =
  "A cross cousin (mother's brother's or father's sister's child). Terms of address vary by region and community.";

type Edge = "up" | "down" | "spouse";

function buildIndex(people: Person[]) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const children = new Map<string, string[]>(people.map((p) => [p.id, []]));
  for (const p of people) for (const pid of p.parentIds) children.get(pid)?.push(p.id);
  return { byId, children };
}

// Shortest chain of links from a to b; null when they are not connected.
export function shortestPath(people: Person[], a: string, b: string): { from: string; to: string; edge: Edge }[] | null {
  const { byId, children } = buildIndex(people);
  if (!byId.has(a) || !byId.has(b)) return null;
  const prev = new Map<string, { from: string; edge: Edge } | null>([[a, null]]);
  const queue = [a];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === b) break;
    const p = byId.get(cur)!;
    const next: [string, Edge][] = [
      ...p.parentIds.map((id): [string, Edge] => [id, "up"]),
      ...(children.get(cur) ?? []).map((id): [string, Edge] => [id, "down"]),
      ...p.spouseIds.map((id): [string, Edge] => [id, "spouse"]),
    ];
    for (const [id, edge] of next) {
      if (byId.has(id) && !prev.has(id)) {
        prev.set(id, { from: cur, edge });
        queue.push(id);
      }
    }
  }
  if (!prev.has(b)) return null;
  const steps: { from: string; to: string; edge: Edge }[] = [];
  for (let cur = b; cur !== a; ) {
    const link = prev.get(cur)!;
    steps.unshift({ from: link.from, to: cur, edge: link.edge });
    cur = link.from;
  }
  return steps;
}

export function findRelationship(people: Person[], person1: Person, person2: Person): RelationshipResult {
  const empty = { gloss: "", signature: "", steps: [] as RelationshipStep[] };
  if (person1.id === person2.id) {
    return { english: "Same person", tamil: "ஒரே நபர்", path: [person1.id], related: true, ...empty };
  }
  const raw = shortestPath(people, person1.id, person2.id);
  if (!raw) {
    return { english: "Not connected in this tree", tamil: "இந்த மரத்தில் தொடர்பு இல்லை", path: [], related: false, ...empty };
  }
  const byId = new Map(people.map((p) => [p.id, p]));
  const gender = (id: string) => byId.get(id)?.gender ?? "";
  const letter = (edge: Edge, id: string) => {
    const g = gender(id);
    if (edge === "up") return g === "male" ? "F" : g === "female" ? "M" : "P";
    if (edge === "down") return g === "male" ? "S" : g === "female" ? "D" : "C";
    return g === "male" ? "H" : g === "female" ? "W" : "E";
  };

  // Collapse "up to a parent, down to their other child" into a sibling step.
  const steps: (RelationshipStep & { half?: boolean })[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i], n = raw[i + 1];
    if (s.edge === "up" && n && n.edge === "down") {
      const g = gender(n.to);
      const a = byId.get(s.from)!, b = byId.get(n.to)!;
      const shared = a.parentIds.filter((pid) => b.parentIds.includes(pid)).length;
      const half = shared === 1 && (a.parentIds.length === 2 || b.parentIds.length === 2);
      steps.push({ letter: g === "male" ? "B" : g === "female" ? "Z" : "G", id: n.to, half });
      i++;
    } else {
      steps.push({ letter: letter(s.edge, s.to), id: s.to });
    }
  }
  const signature = steps.map((s) => s.letter).join("");
  const term = kinTerm(signature, steps, person1, person2, byId);
  // "elder brother" → "elder half-brother" when only one parent is shared
  if (steps.length === 1 && steps[0].half) term.english = term.english.replace(/(brother|sister|sibling)$/, "half-$1");
  return {
    ...term,
    path: [person1.id, ...raw.map((s) => s.to)],
    gloss: steps.map((s) => WORD[s.letter]).join("'s "),
    signature,
    steps,
    related: true,
  };
}

type Term = { english: string; tamil: string; address?: string; note?: string };

function kinTerm(sig: string, steps: RelationshipStep[], A: Person, B: Person, byId: Map<string, Person>): Term {
  const T = (english: string, tamil: string, extra: Partial<Term> = {}): Term => ({ english, tamil, ...extra });
  // true: x is older than y · false: younger · null: unknown (a same-year birth needs both full dates)
  const older = (x: string, y: string) => {
    const c = compareDates(byId.get(x)?.birth?.date, byId.get(y)?.birth?.date);
    return c == null || c === 0 ? null : c < 0;
  };
  const byAge = (x: string, y: string, elder: Term, younger: Term, unknown: Term) => {
    const o = older(x, y);
    return o === true ? elder : o === false ? younger : unknown;
  };
  const at = (i: number) => steps[i].id;
  const speaker = A.gender;

  switch (sig) {
    case "F": return T("father", "அப்பா");
    case "M": return T("mother", "அம்மா");
    case "P": return T("parent", "பெற்றோர்");
    case "S": return T("son", "மகன்");
    case "D": return T("daughter", "மகள்");
    case "C": return T("child", "குழந்தை");
    case "H": return T("husband", "கணவர்");
    case "W": return T("wife", "மனைவி");
    case "E": return T("spouse", "வாழ்க்கைத் துணை");
    case "B": return byAge(B.id, A.id, T("elder brother", "அண்ணன்"), T("younger brother", "தம்பி"), T("brother", "அண்ணன் / தம்பி", { note: AGE_NOTE }));
    case "Z": return byAge(B.id, A.id, T("elder sister", "அக்கா"), T("younger sister", "தங்கை"), T("sister", "அக்கா / தங்கை", { note: AGE_NOTE }));
    case "G": return T("sibling", "உடன்பிறப்பு");
    case "FF": return T("paternal grandfather", "தாத்தா");
    case "MF": return T("maternal grandfather", "தாத்தா");
    case "FM": return T("paternal grandmother", "பாட்டி", { note: "Also அப்பத்தா in some regions." });
    case "MM": return T("maternal grandmother", "பாட்டி", { note: "Also அம்மாயி / அம்மம்மா in some regions." });
    case "SS": case "DS": return T("grandson", "பேரன்");
    case "SD": case "DD": return T("granddaughter", "பேத்தி");
    case "FB": return byAge(at(1), at(0), T("paternal uncle", "பெரியப்பா", { note: "Father's elder brother." }), T("paternal uncle", "சித்தப்பா", { note: "Father's younger brother." }), T("paternal uncle", "பெரியப்பா / சித்தப்பா", { note: AGE_NOTE }));
    case "MZ": return byAge(at(1), at(0), T("maternal aunt", "பெரியம்மா", { note: "Mother's elder sister." }), T("maternal aunt", "சித்தி", { note: "Mother's younger sister." }), T("maternal aunt", "பெரியம்மா / சித்தி", { note: AGE_NOTE }));
    case "MB": return T("maternal uncle", "மாமா", { note: "Mother's brother, the தாய் மாமன், who has a special role at weddings and ceremonies." });
    case "FZ": return T("paternal aunt", "அத்தை");
    // By marriage: the term follows the blood uncle/aunt in the middle (audit L-01)
    case "FBW": return byAge(at(1), at(0), T("aunt by marriage", "பெரியம்மா"), T("aunt by marriage", "சித்தி"), T("aunt by marriage", "பெரியம்மா / சித்தி", { note: AGE_NOTE }));
    case "MZH": return byAge(at(1), at(0), T("uncle by marriage", "பெரியப்பா"), T("uncle by marriage", "சித்தப்பா"), T("uncle by marriage", "பெரியப்பா / சித்தப்பா", { note: AGE_NOTE }));
    case "FZH": return T("uncle by marriage", "மாமா");
    case "MBW": return T("aunt by marriage", "அத்தை", { address: "மாமி", note: "Mother's brother's wife; called மாமி in many families." });
    // Cousins: parallel vs cross (audit L-02), elder vs younger (L-03)
    case "FBS": case "MZS": return byAge(B.id, A.id, T("cousin", "அண்ணன்", { note: PARALLEL }), T("cousin", "தம்பி", { note: PARALLEL }), T("cousin", "அண்ணன் / தம்பி", { note: `${PARALLEL} ${AGE_NOTE}` }));
    case "FBD": case "MZD": return byAge(B.id, A.id, T("cousin", "அக்கா", { note: PARALLEL }), T("cousin", "தங்கை", { note: PARALLEL }), T("cousin", "அக்கா / தங்கை", { note: `${PARALLEL} ${AGE_NOTE}` }));
    case "MBS": case "FZS": return T("cousin", sig[0] === "M" ? "மாமன் மகன்" : "அத்தை மகன்", { address: byAge(B.id, A.id, T("", "அத்தான்"), T("", "மச்சான்"), T("", "அத்தான் / மச்சான்")).tamil, note: CROSS });
    case "MBD": case "FZD": return T("cousin", sig[0] === "M" ? "மாமன் மகள்" : "அத்தை மகள்", { address: speaker === "male" ? "முறைப்பெண்" : byAge(B.id, A.id, T("", "அண்ணி"), T("", "மச்சினி"), T("", "அண்ணி / மச்சினி")).tamil, note: CROSS });
    case "BS": case "ZS": case "BD": case "ZD": {
      const siblingGender = sig[0] === "B" ? "male" : "female", boy = sig[1] === "S";
      const english = boy ? "nephew" : "niece";
      if (speaker !== "male" && speaker !== "female") {
        return T(english, boy ? "மருமகன் / மகன்" : "மருமகள் / மகள்", { note: "The Tamil term depends on whether the speaker and the sibling are the same sex. Set the speaker's gender." });
      }
      return speaker === siblingGender
        ? T(english, boy ? "மகன்" : "மகள்", { note: "A same-sex sibling's child is traditionally treated as one's own child." })
        : T(english, boy ? "மருமகன்" : "மருமகள்");
    }
    // In-laws: speaker gender matters (audit L-04)
    case "HF": case "WF": return T("father-in-law", "மாமனார்");
    case "HM": case "WM": return T("mother-in-law", "மாமியார்");
    case "SW": return T("daughter-in-law", "மருமகள்");
    case "DH": return T("son-in-law", "மருமகன்");
    case "WB": return T("brother-in-law", "மச்சான்", { note: "Wife's brother; the formal word is மைத்துனர்." });
    case "WZ": return byAge(at(1), at(0), T("sister-in-law", "அண்ணி", { note: "Wife's elder sister." }), T("sister-in-law", "கொழுந்தியாள்", { note: "Wife's younger sister." }), T("sister-in-law", "அண்ணி / கொழுந்தியாள்", { note: AGE_NOTE }));
    case "HB": return byAge(at(1), at(0), T("brother-in-law", "மச்சான்", { note: "Husband's elder brother; some families say பெரிய மாமா." }), T("brother-in-law", "கொழுந்தன்", { note: "Husband's younger brother." }), T("brother-in-law", "மச்சான் / கொழுந்தன்", { note: AGE_NOTE }));
    case "HZ": return T("sister-in-law", "நாத்தனார்");
    case "BW": return byAge(at(0), A.id, T("sister-in-law", "அண்ணி"), T("sister-in-law", "தம்பி மனைவி", { note: "Usually addressed by name." }), T("sister-in-law", "அண்ணி", { note: AGE_NOTE }));
    case "ZH": return byAge(at(0), A.id, T("brother-in-law", "அத்தான்", { note: "Elder sister's husband; also மாமா." }), T("brother-in-law", "மச்சான்", { note: "Younger sister's husband; also மாப்பிள்ளை." }), T("brother-in-law", "அத்தான் / மச்சான்", { note: AGE_NOTE }));
    case "WZH": return T("co-brother", "சகலை");
    case "HBW": return T("co-sister", "ஓரகத்தி");
    case "SWF": case "DHF": case "SWM": case "DHM": return T("child's parent-in-law", "சம்பந்தி");
  }
  if (/^[FMP]{3}$/.test(sig)) return T(sig[2] === "F" ? "great-grandfather" : sig[2] === "M" ? "great-grandmother" : "great-grandparent", sig[2] === "M" ? "கொள்ளுப் பாட்டி" : "கொள்ளுத் தாத்தா");
  if (/^[SDC]{3}$/.test(sig)) return T(sig[2] === "D" ? "great-granddaughter" : sig[2] === "S" ? "great-grandson" : "great-grandchild", sig[2] === "D" ? "கொள்ளுப்பேத்தி" : "கொள்ளுப்பேரன்");
  if (/^[FMP]+$/.test(sig)) return T(`ancestor, ${sig.length} generations up`, `மூதாதையர் · ${sig.length} தலைமுறை`);
  if (/^[SDC]+$/.test(sig)) return T(`descendant, ${sig.length} generations down`, `வழித்தோன்றல் · ${sig.length} தலைமுறை`);
  const fallbackNote = "There's no single word for this one; the chain below shows how you're connected.";
  if (/[HWE]/.test(sig)) return T("relative by marriage", "திருமண உறவு", { note: fallbackNote });
  return T("blood relative", "இரத்த உறவு", { note: fallbackNote });
}

// "Vishal is Ashwin's cousin" — B relative to A, with a clear no-link case (audit R-03).
export function relationshipSentence(result: RelationshipResult, nameA: string, nameB: string): string {
  if (!result.related) return `${nameB} and ${nameA} aren't connected in this tree yet.`;
  if (result.path.length === 1) return `${nameA} is the same person.`;
  return `${nameB} is ${nameA}'s ${result.english}${result.gloss && result.gloss !== result.english ? ` (${result.gloss})` : ""}.`;
}
