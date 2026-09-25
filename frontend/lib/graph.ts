import { Marriage, Person, Position } from "./types";
import { wouldCreateCycle } from "./cycles";

// Single place where relationships change. Every action returns a normalized list, so the
// invariants below always hold no matter which view or form triggered the change:
//   - parentIds: at most 2, no self, no dangling ids, no duplicates
//   - childIds:  exactly mirrors everyone's parentIds
//   - spouseIds: symmetric, no self, no dangling ids
//   - marriages: one record per spouse, mirrored on both spouses (same date/place/divorce)

export interface NormalizeReport {
  duplicatesRemoved: number;
  danglingRefsRemoved: number;
  linksRepaired: number;
  extraParentsDropped: number;
}

const unique = <T,>(xs: T[]) => Array.from(new Set(xs));

function clonePerson(p: Person): Person {
  return {
    ...p,
    birth: { ...(p.birth ?? { date: "", place: "" }) },
    death: p.death ? { ...p.death } : null,
    parentIds: [...(p.parentIds ?? [])],
    spouseIds: [...(p.spouseIds ?? [])],
    childIds: [...(p.childIds ?? [])],
    marriages: (p.marriages ?? []).map((m) => ({ ...m })),
    position: p.position ? { ...p.position } : null,
  };
}

export function normalize(input: Person[]): { people: Person[]; report: NormalizeReport } {
  const report: NormalizeReport = { duplicatesRemoved: 0, danglingRefsRemoved: 0, linksRepaired: 0, extraParentsDropped: 0 };
  const seen = new Set<string>();
  const people: Person[] = [];
  for (const p of input) {
    if (seen.has(p.id)) { report.duplicatesRemoved++; continue; }
    seen.add(p.id);
    people.push(clonePerson(p));
  }
  const byId = new Map(people.map((p) => [p.id, p]));
  const exists = (id: string) => byId.has(id);

  // Parents: clean up, then honour one-sided "childIds" claims (older files) while there is room.
  for (const p of people) {
    const cleaned = unique(p.parentIds).filter((id) => id !== p.id);
    const valid = cleaned.filter(exists);
    report.danglingRefsRemoved += cleaned.length - valid.length;
    p.parentIds = valid;
  }
  for (const p of people) {
    for (const cid of unique(p.childIds)) {
      const child = byId.get(cid);
      if (!child || cid === p.id) continue;
      if (!child.parentIds.includes(p.id) && child.parentIds.length < 2) {
        child.parentIds.push(p.id);
        report.linksRepaired++;
      }
    }
  }
  for (const p of people) {
    if (p.parentIds.length > 2) {
      report.extraParentsDropped += p.parentIds.length - 2;
      p.parentIds = p.parentIds.slice(0, 2);
    }
  }
  // Children are derived from parents.
  const children = new Map<string, string[]>(people.map((p) => [p.id, []]));
  for (const p of people) p.parentIds.forEach((pid) => children.get(pid)!.push(p.id));
  for (const p of people) {
    const derived = children.get(p.id)!;
    report.linksRepaired += derived.filter((id) => !p.childIds.includes(id)).length;
    p.childIds = derived;
  }

  // Spouses: union of both directions, plus anyone named in a marriage record.
  const spouseSets = new Map<string, Set<string>>(people.map((p) => [p.id, new Set<string>()]));
  const addSpouse = (a: string, b: string) => {
    if (a === b || !exists(a) || !exists(b)) return false;
    spouseSets.get(a)!.add(b);
    spouseSets.get(b)!.add(a);
    return true;
  };
  for (const p of people) {
    for (const sid of [...p.spouseIds, ...p.marriages.map((m) => m.spouseId)]) {
      if (!addSpouse(p.id, sid)) { if (sid !== p.id) report.danglingRefsRemoved++; }
    }
  }
  for (const p of people) {
    const next = Array.from(spouseSets.get(p.id)!);
    const added = next.filter((id) => !p.spouseIds.includes(id)).length;
    report.linksRepaired += added;
    // keep the original order where possible
    p.spouseIds = [...p.spouseIds.filter((id) => next.includes(id)), ...next.filter((id) => !p.spouseIds.includes(id))];
    p.spouseIds = unique(p.spouseIds);
  }
  // Marriages: one record per spouse, mirrored.
  for (const p of people) {
    const records = new Map<string, Marriage>();
    for (const m of p.marriages) if (p.spouseIds.includes(m.spouseId) && !records.has(m.spouseId)) records.set(m.spouseId, m);
    p.marriages = Array.from(records.values());
  }
  for (const p of people) {
    for (const m of p.marriages) {
      const other = byId.get(m.spouseId)!;
      if (!other.marriages.some((om) => om.spouseId === p.id)) {
        other.marriages.push({ ...m, spouseId: p.id });
        report.linksRepaired++;
      }
    }
  }
  return { people, report };
}

export type GraphAction =
  | { type: "replaceAll"; people: Person[] }
  | { type: "addPerson"; person: Person }
  | { type: "updateFields"; id: string; fields: Partial<Omit<Person, "id" | "parentIds" | "childIds" | "spouseIds" | "marriages">> }
  | { type: "setParents"; id: string; parentIds: string[] }
  | { type: "setMarriages"; id: string; marriages: Marriage[] }
  | { type: "deletePerson"; id: string }
  | { type: "setPositions"; positions: Record<string, Position | null> }
  // A whole form save as one undoable step: fields, then parents (if allowed), then marriages
  | { type: "updatePerson"; person: Person };

// Would these parents be accepted for `id`? (UI checks this before dispatching.)
export function canSetParents(people: Person[], id: string, parentIds: string[]): { ok: boolean; reason?: string } {
  const ids = unique(parentIds).filter(Boolean);
  if (ids.length > 2) return { ok: false, reason: "A person can have at most two parents" };
  const others = people.map((p) => (p.id === id ? { ...p, parentIds: [] } : p));
  for (const pid of ids) {
    if (wouldCreateCycle(others, id, pid)) return { ok: false, reason: "That would make someone their own ancestor" };
  }
  return { ok: true };
}

const mirror = (m: Marriage, spouseId: string): Marriage => ({ ...m, spouseId });

export function graphReducer(people: Person[], action: GraphAction): Person[] {
  switch (action.type) {
    case "replaceAll":
      return normalize(action.people).people;
    case "addPerson":
      if (people.some((p) => p.id === action.person.id)) return people;
      return normalize([...people, action.person]).people;
    case "updateFields":
      return people.map((p) => (p.id === action.id ? { ...p, ...action.fields } : p));
    case "setParents": {
      if (!canSetParents(people, action.id, action.parentIds).ok) return people;
      const parentIds = unique(action.parentIds).filter(Boolean);
      const next = people.map((p) => {
        if (p.id === action.id) return { ...p, parentIds };
        // drop stale child claims so normalize does not re-add the old link
        if (p.childIds.includes(action.id) && !parentIds.includes(p.id)) return { ...p, childIds: p.childIds.filter((c) => c !== action.id) };
        return p;
      });
      return normalize(next).people;
    }
    case "setMarriages": {
      const self = people.find((p) => p.id === action.id);
      if (!self) return people;
      const wanted = new Map<string, Marriage>();
      for (const m of action.marriages) {
        if (m.spouseId && m.spouseId !== action.id && people.some((p) => p.id === m.spouseId) && !wanted.has(m.spouseId)) wanted.set(m.spouseId, m);
      }
      const next = people.map((p) => {
        if (p.id === action.id) return { ...p, spouseIds: Array.from(wanted.keys()), marriages: Array.from(wanted.values()) };
        const m = wanted.get(p.id);
        if (m) {
          return {
            ...p,
            spouseIds: p.spouseIds.includes(action.id) ? p.spouseIds : [...p.spouseIds, action.id],
            marriages: [...p.marriages.filter((om) => om.spouseId !== action.id), mirror(m, action.id)],
          };
        }
        if (p.spouseIds.includes(action.id) || p.marriages.some((om) => om.spouseId === action.id)) {
          return { ...p, spouseIds: p.spouseIds.filter((s) => s !== action.id), marriages: p.marriages.filter((om) => om.spouseId !== action.id) };
        }
        return p;
      });
      return normalize(next).people;
    }
    case "deletePerson": {
      const next = people
        .filter((p) => p.id !== action.id)
        .map((p) => ({
          ...p,
          parentIds: p.parentIds.filter((id) => id !== action.id),
          childIds: p.childIds.filter((id) => id !== action.id),
          spouseIds: p.spouseIds.filter((id) => id !== action.id),
          marriages: p.marriages.filter((m) => m.spouseId !== action.id),
        }));
      return normalize(next).people;
    }
    case "setPositions":
      return people.map((p) => (p.id in action.positions ? { ...p, position: action.positions[p.id] } : p));
    case "updatePerson": {
      const { id, parentIds, marriages, childIds: _c, spouseIds: _s, ...fields } = action.person;
      if (!people.some((p) => p.id === id)) return people;
      let next = graphReducer(people, { type: "updateFields", id, fields });
      const current = next.find((p) => p.id === id)!;
      if (parentIds.join("|") !== current.parentIds.join("|")) next = graphReducer(next, { type: "setParents", id, parentIds });
      return graphReducer(next, { type: "setMarriages", id, marriages });
    }
  }
}

// ---- undo / redo ----

export interface HistoryState {
  past: Person[][];
  present: Person[];
  future: Person[][];
  lastKey: string | null;
}

export type HistoryAction =
  | (GraphAction & { coalesceKey?: string })
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load"; people: Person[] }; // restore from storage: no history entry

const HISTORY_LIMIT = 100;

export const initialHistory: HistoryState = { past: [], present: [], future: [], lastKey: null };

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "undo": {
      if (!state.past.length) return state;
      return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future], lastKey: null };
    }
    case "redo": {
      if (!state.future.length) return state;
      return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1), lastKey: null };
    }
    case "load":
      return { past: [], present: normalize(action.people).people, future: [], lastKey: null };
    default: {
      const present = graphReducer(state.present, action);
      if (present === state.present) return state;
      const key = "coalesceKey" in action && action.coalesceKey ? action.coalesceKey : null;
      // consecutive actions with the same key (e.g. one drag) collapse into one undo step
      if (key && key === state.lastKey) return { ...state, present, future: [] };
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present, future: [], lastKey: key };
    }
  }
}
