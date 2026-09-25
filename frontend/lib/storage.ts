import { get, set } from "idb-keyval";
import { Person } from "./types";
import { CURRENT_VERSION } from "./json-schema";

// Autosave lives in IndexedDB rather than localStorage: photos are data URLs and a real family
// quickly passes localStorage's ~5 MB limit.
const KEY = "family-tree:v1";

export interface SavedTree {
  version: number;
  people: Person[];
  savedAt: number;
}

export async function loadTree(): Promise<SavedTree | null> {
  try {
    const saved = await get<SavedTree>(KEY);
    return saved && Array.isArray(saved.people) ? saved : null;
  } catch {
    return null; // private mode / storage blocked: start empty rather than crash
  }
}

export async function saveTree(people: Person[]): Promise<number> {
  const savedAt = Date.now();
  await set(KEY, { version: CURRENT_VERSION, people, savedAt } satisfies SavedTree);
  return savedAt;
}
