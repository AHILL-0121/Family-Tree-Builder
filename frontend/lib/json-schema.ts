import { z } from "zod";
import { FamilyTreeData, Person, createEmptyPerson } from "./types";
import { normalize, NormalizeReport } from "./graph";
import { validateTree } from "./cycles";
import { newId } from "./id";

export const CURRENT_VERSION = 3;

// Lenient schema: every field except id is optional so older files load, but anything present
// must have the right type. Unknown fields are dropped.
const str = z.string().optional().nullable().transform((v) => v ?? "");
const idList = z.array(z.union([z.string(), z.number()]).transform(String)).optional().transform((v) => v ?? []);
const event = z.object({ date: str, place: str }).partial().optional().nullable();
const marriageSchema = z.object({
  spouseId: z.union([z.string(), z.number()]).transform(String),
  date: str,
  place: str,
  divorced: z.boolean().optional().default(false),
  divorceDate: str,
  divorcePlace: str,
});
const personSchema = z.object({
  id: z.union([z.string().min(1), z.number()]).transform(String),
  name: str,
  givenName: str,
  surname: str,
  gender: z.enum(["male", "female", "other", ""]).optional().catch("").transform((v) => v ?? ""),
  occupation: str,
  notes: str,
  birth: event,
  death: event,
  parentIds: idList,
  spouseIds: idList,
  childIds: idList,
  marriages: z.array(marriageSchema).optional().transform((v) => v ?? []),
  avatarUrl: z.string().optional().nullable().transform((v) => v || null),
  position: z.object({ x: z.number(), y: z.number() }).optional().nullable().transform((v) => v ?? null),
});
const fileSchema = z.object({
  version: z.number().int().positive().optional().default(1),
  people: z.array(z.unknown()),
});

export interface ImportResult {
  ok: boolean;
  error?: string;
  data?: FamilyTreeData;
  report?: NormalizeReport & { skipped: number; migratedFrom: number };
}

// Version migrations. v1 files had a single `name` and no given/surname split; v2 had no
// marriage records. Both are upgraded field by field so nothing the user entered is lost.
function migrate(raw: z.infer<typeof personSchema>, version: number): Person {
  const p: Person = {
    ...createEmptyPerson(raw.id),
    name: raw.name,
    givenName: raw.givenName,
    surname: raw.surname,
    gender: raw.gender,
    occupation: raw.occupation,
    notes: raw.notes,
    birth: { date: raw.birth?.date ?? "", place: raw.birth?.place ?? "" },
    death: raw.death && (raw.death.date || raw.death.place) ? { date: raw.death.date ?? "", place: raw.death.place ?? "" } : raw.death ? { date: "", place: "" } : null,
    parentIds: raw.parentIds,
    spouseIds: raw.spouseIds,
    childIds: raw.childIds,
    marriages: raw.marriages,
    avatarUrl: raw.avatarUrl,
    position: raw.position,
  };
  if (version < 2 && !p.givenName && !p.surname && p.name) {
    const [given, ...rest] = p.name.trim().split(/\s+/);
    p.givenName = given ?? "";
    p.surname = rest.join(" ");
  }
  return p;
}

export function importFamilyTree(json: unknown): ImportResult {
  const file = fileSchema.safeParse(json);
  if (!file.success) return { ok: false, error: "This isn't a family tree file (missing a people list)." };
  if (file.data.version > CURRENT_VERSION) {
    return { ok: false, error: `This file was made by a newer version (v${file.data.version}). Please update the app.` };
  }
  const people: Person[] = [];
  let skipped = 0;
  for (const item of file.data.people) {
    const parsed = personSchema.safeParse(item);
    if (parsed.success) people.push(migrate(parsed.data, file.data.version));
    else skipped++;
  }
  const { people: normalized, report } = normalize(people);
  const cycle = validateTree(normalized);
  if (!cycle.valid) return { ok: false, error: `${cycle.error}. Fix the file and try again.` };
  return {
    ok: true,
    data: { version: CURRENT_VERSION, people: normalized },
    report: { ...report, skipped, migratedFrom: file.data.version },
  };
}

export function describeImport(report: NonNullable<ImportResult["report"]>): string {
  const bits: string[] = [];
  if (report.skipped) bits.push(`${report.skipped} unreadable entr${report.skipped === 1 ? "y" : "ies"} skipped`);
  if (report.duplicatesRemoved) bits.push(`${report.duplicatesRemoved} duplicate${report.duplicatesRemoved === 1 ? "" : "s"} removed`);
  if (report.danglingRefsRemoved) bits.push(`${report.danglingRefsRemoved} link${report.danglingRefsRemoved === 1 ? "" : "s"} to missing people removed`);
  if (report.linksRepaired) bits.push(`${report.linksRepaired} one-sided link${report.linksRepaired === 1 ? "" : "s"} repaired`);
  if (report.extraParentsDropped) bits.push(`${report.extraParentsDropped} extra parent link${report.extraParentsDropped === 1 ? "" : "s"} dropped`);
  if (report.migratedFrom < CURRENT_VERSION) bits.push(`upgraded from format v${report.migratedFrom}`);
  return bits.join(" · ");
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

// Kept for older call sites; prefer newId() from ./id.
export const generateId = newId;
