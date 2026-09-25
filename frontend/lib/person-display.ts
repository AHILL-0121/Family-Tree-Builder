import { Person, getFullName } from "./types";
import { firstGrapheme } from "./avatar";

export const yearOf = (s: string | null | undefined): number | null => {
  const m = String(s ?? "").match(/\d{4}/);
  return m ? Number(m[0]) : null;
};

export function yearsLabel(p: Person): string {
  const b = yearOf(p.birth?.date), d = yearOf(p.death?.date);
  if (d) return `${b ?? "?"} – ${d}`;
  if (b) return `b. ${b}`;
  return p.death ? "deceased" : "";
}

export function initialOf(p: Person): string {
  return firstGrapheme(p.givenName || p.surname || getFullName(p)) || "?";
}

export const byBirthYear = (a: Person, b: Person) => (yearOf(a.birth?.date) ?? 9999) - (yearOf(b.birth?.date) ?? 9999);

// Screen-reader description: "Kamala, born 1962, child of Arulmozhi and Meenakshi, married to Rajasekar"
export function describePerson(p: Person, byId: Map<string, Person>): string {
  const names = (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean).map((q) => getFullName(q!));
  const parts = [getFullName(p)];
  const yrs = yearsLabel(p);
  if (yrs) parts.push(yrs.replace(/^b\. /, "born "));
  const parents = names(p.parentIds);
  if (parents.length) parts.push(`child of ${parents.join(" and ")}`);
  const spouses = names(p.spouseIds);
  if (spouses.length) parts.push(`married to ${spouses.join(", ")}`);
  return parts.join(", ");
}

export function siblingsOf(p: Person, people: Person[]): { person: Person; half: boolean }[] {
  if (!p.parentIds.length) return [];
  return people
    .filter((o) => o.id !== p.id && o.parentIds.some((pid) => p.parentIds.includes(pid)))
    .sort(byBirthYear)
    .map((o) => ({ person: o, half: !(o.parentIds.length === p.parentIds.length && o.parentIds.every((pid) => p.parentIds.includes(pid))) }));
}
