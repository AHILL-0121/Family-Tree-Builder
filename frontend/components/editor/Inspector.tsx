"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Person, getFullName } from "@/lib/types";
import { findRelationship, relationshipSentence } from "@/lib/relationships";
import { byBirthYear, initialOf, siblingsOf, yearOf, yearsLabel } from "@/lib/person-display";
import { DATE_HINT, DATE_PLACEHOLDER, compareDates, formatDate, parseDateInput } from "@/lib/dates";
import { PersonEditor } from "./PersonEditor";
import { PhotoViewer } from "./PhotoViewer";
import { GenderPicker, btnBrand, btnPlain, btnPrimary, inputCls, labelCls, sectionTitle } from "./form";
import type { AddType } from "./FamilyCanvas";

export type InspectorState =
  | { kind: "overview" }
  | { kind: "person"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "new"; draft: Person; type: AddType | "first"; anchorId: string | null }
  | { kind: "relate" };


function Portrait({ p, size = "sm" }: { p: Person; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-14 w-14 text-2xl" : "h-[22px] w-[22px] text-[11px]";
  return p.avatarUrl ? (
    <img src={p.avatarUrl} alt="" className={`${cls} flex-none rounded-full object-cover`} />
  ) : (
    <span aria-hidden className={`${cls} grid flex-none place-items-center rounded-full bg-portrait font-serif text-ink-2`}>{initialOf(p)}</span>
  );
}

function Chip({ p, extra, onClick }: { p: Person; extra?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-rule bg-card pl-[3px] pr-2.5 text-[13px] hover:border-line">
      <Portrait p={p} />
      <span className="truncate">{getFullName(p)}</span>
      {extra && <small className="font-mono text-[10.5px] text-ink-3">{extra}</small>}
    </button>
  );
}

function AddChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-7 items-center rounded-full border border-dashed border-rule px-2.5 text-[13px] text-ink-3 hover:border-brand hover:text-brand">
      + {label}
    </button>
  );
}

interface InspectorProps {
  state: InspectorState;
  people: Person[];
  treeName: string;
  relate: { a: string | null; b: string | null; slot: "a" | "b" };
  onGoto: (id: string) => void;
  onAdd: (type: AddType, anchorId: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStartRelate: (id: string) => void;
  onSaveEdit: (p: Person) => void;
  onCancel: () => void;
  onCreate: (p: Person, opts: { marryExisting: boolean; otherParent: string | null; marriageYear: string }) => void;
  onRelateSlot: (slot: "a" | "b") => void;
  onRelateSwap: () => void;
  onRelateClear: () => void;
  onRelateDone: () => void;
}

export function Inspector(props: InspectorProps) {
  const { state, people } = props;
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  if (state.kind === "relate") return <RelatePanel {...props} byId={byId} />;
  if (state.kind === "new") return <NewPersonForm key={state.draft.id} {...props} state={state} byId={byId} />;
  if (state.kind === "edit" && byId.has(state.id)) {
    const p = byId.get(state.id)!;
    return <PersonEditor key={p.id} person={p} people={people} onSave={props.onSaveEdit} onCancel={props.onCancel} />;
  }
  if (state.kind === "person" && byId.has(state.id)) return <PersonView {...props} person={byId.get(state.id)!} byId={byId} />;
  return <Overview {...props} />;
}

function Overview({ people, treeName }: InspectorProps) {
  const years = people.map((p) => yearOf(p.birth?.date)).filter((y): y is number => y != null);
  const couples = people.reduce((a, p) => a + p.spouseIds.length, 0) / 2;
  const keys: [string, string][] = [
    ["Ctrl K", "Find anyone, run any action"],
    ["↑ ↓", "Move to a parent / child"],
    ["← →", "Move along a generation"],
    ["Click", "See a person's details"],
    ["Double-click", "Edit a person"],
    ["Enter", "Open the focused person"],
    ["Ctrl Z", "Undo; nothing is final"],
    ["F", "Fit the tree to the screen"],
    ["/", "Search the people list"],
  ];
  return (
    <div className="flex-1 overflow-auto p-5">
      <h2 className="mb-1.5 font-serif text-[22px] font-medium">{treeName || "Your family"}</h2>
      <p className="mb-5 text-[13px] text-ink-2">Select someone to see their details. The + handles on their card add relatives in place.</p>
      <div className="mb-5 grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-rule bg-rule">
        {[[people.length, "people"], [couples, "couples"], [years.length ? Math.min(...years) : "—", "earliest birth"]].map(([v, l]) => (
          <div key={String(l)} className="bg-card p-3">
            <b className="block font-serif text-2xl font-medium">{v}</b>
            <span className="font-mono text-[11px] text-ink-3">{l}</span>
          </div>
        ))}
      </div>
      <section className="border-t border-rule pt-3.5">
        <h3 className={sectionTitle}>Shortcuts</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[13px] text-ink-2">
          {keys.map(([k, d]) => (
            <React.Fragment key={k}>
              <dt className="whitespace-nowrap">{k.split(" ").map((part) => <kbd key={part} className="mr-1 rounded border border-b-2 border-rule bg-surface px-1.5 font-mono text-[11px] text-ink-3">{part}</kbd>)}</dt>
              <dd>{d}</dd>
            </React.Fragment>
          ))}
        </dl>
      </section>
    </div>
  );
}

function PersonView({ person: p, people, byId, onGoto, onAdd, onEdit, onDelete, onStartRelate }: InspectorProps & { person: Person; byId: Map<string, Person> }) {
  const [viewing, setViewing] = useState(false);
  const parents = p.parentIds.map((id) => byId.get(id)).filter((x): x is Person => !!x);
  const spouses = p.spouseIds.map((id) => byId.get(id)).filter((x): x is Person => !!x);
  const children = p.childIds.map((id) => byId.get(id)).filter((x): x is Person => !!x).sort(byBirthYear);
  const siblings = siblingsOf(p, people);
  const sub = [yearsLabel(p), p.birth?.place].filter(Boolean).join(" · ");
  const gender = { male: "Male", female: "Female", other: "Other", "": "" }[p.gender];
  const facts: [string, string][] = [
    ["Born", [formatDate(p.birth?.date), p.birth?.place].filter(Boolean).join(", ")],
    ["Died", p.death ? [formatDate(p.death.date), p.death.place].filter(Boolean).join(", ") || "Yes" : ""],
    ["Occupation", p.occupation],
    ["Gender", gender],
  ];
  const shown = facts.filter(([, v]) => v);
  const Row = ({ label, children: kids }: { label: string; children: React.ReactNode }) => (
    <>
      <dt className="pt-1 text-[12.5px] text-ink-3">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">{kids}</dd>
    </>
  );
  return (
    <>
      <div className="flex-1 overflow-auto p-5">
        <header className="mb-5 flex items-center gap-3.5">
          {p.avatarUrl ? (
            <button type="button" onClick={() => setViewing(true)} aria-label={`View photo of ${getFullName(p)}`} title="View photo" className="flex-none rounded-full transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              <Portrait p={p} size="lg" />
            </button>
          ) : (
            <Portrait p={p} size="lg" />
          )}
          <PhotoViewer src={viewing ? p.avatarUrl : null} name={getFullName(p)} caption={yearsLabel(p)} onClose={() => setViewing(false)} />
          <div className="min-w-0">
            <h2 className="break-words font-serif text-[26px] font-medium leading-tight">{getFullName(p)}</h2>
            {sub && <p className="mt-1 font-mono text-xs text-ink-3">{sub}</p>}
          </div>
        </header>
        <section className="border-t border-rule pb-1.5 pt-3.5">
          <h3 className={sectionTitle}>Relations</h3>
          <dl className="grid grid-cols-[76px_1fr] gap-x-2.5 gap-y-2">
            <Row label="Parents">
              {parents.map((q) => <Chip key={q.id} p={q} onClick={() => onGoto(q.id)} />)}
              {parents.length < 2 && <AddChip label="Parent" onClick={() => onAdd("parent", p.id)} />}
            </Row>
            <Row label="Spouse">
              {spouses.map((q) => {
                const m = p.marriages.find((mm) => mm.spouseId === q.id);
                const extra = m?.date ? `m. ${yearOf(m.date) ?? m.date}${m.divorced ? " · div." : ""}` : m?.divorced ? "div." : undefined;
                return <Chip key={q.id} p={q} extra={extra} onClick={() => onGoto(q.id)} />;
              })}
              <AddChip label="Spouse" onClick={() => onAdd("spouse", p.id)} />
            </Row>
            <Row label="Children">
              {children.map((q) => <Chip key={q.id} p={q} onClick={() => onGoto(q.id)} />)}
              <AddChip label="Child" onClick={() => onAdd("child", p.id)} />
            </Row>
            <Row label="Siblings">
              {siblings.map(({ person: q, half }) => <Chip key={q.id} p={q} extra={half ? "half" : undefined} onClick={() => onGoto(q.id)} />)}
              <AddChip label="Sibling" onClick={() => onAdd("sibling", p.id)} />
            </Row>
          </dl>
        </section>
        <section className="border-t border-rule pb-1.5 pt-3.5">
          <h3 className={sectionTitle}>Details</h3>
          {shown.length ? (
            <dl className="grid grid-cols-[76px_1fr] gap-x-2.5 gap-y-1.5 text-[13.5px]">
              {shown.map(([k, v]) => (
                <React.Fragment key={k}><dt className="text-[12.5px] text-ink-3">{k}</dt><dd>{v}</dd></React.Fragment>
              ))}
            </dl>
          ) : (
            <p className="text-[13px] text-ink-3">No details yet.</p>
          )}
        </section>
        {p.notes && (
          <section className="border-t border-rule pb-1.5 pt-3.5">
            <h3 className={sectionTitle}>Notes</h3>
            <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-ink-2">{p.notes}</p>
          </section>
        )}
      </div>
      <footer className="sticky bottom-0 flex gap-2 border-t border-rule bg-surface px-5 py-3">
        <button type="button" className={`${btnBrand} flex-1`} onClick={() => onStartRelate(p.id)}>Find relationship…</button>
        <button type="button" className={btnPlain} onClick={() => onEdit(p.id)}>Edit</button>
        <button type="button" className={`${btnPlain} text-brand`} onClick={() => onDelete(p.id)} aria-label={`Delete ${getFullName(p)}`}>Delete</button>
      </footer>
    </>
  );
}

function NewPersonForm({ state, byId, onCreate, onCancel }: InspectorProps & { state: Extract<InspectorState, { kind: "new" }>; byId: Map<string, Person> }) {
  const anchor = state.anchorId ? byId.get(state.anchorId) ?? null : null;
  const [given, setGiven] = useState(state.draft.givenName);
  const [surname, setSurname] = useState(state.draft.surname);
  const [gender, setGender] = useState<Person["gender"]>(state.draft.gender);
  const [born, setBorn] = useState("");
  const [died, setDied] = useState("");
  const [place, setPlace] = useState("");
  const [marry, setMarry] = useState(true);
  const [marriageYear, setMarriageYear] = useState("");
  const spouses = anchor ? anchor.spouseIds.map((id) => byId.get(id)).filter((x): x is Person => !!x) : [];
  const [otherParent, setOtherParent] = useState<string>(state.draft.parentIds.find((id) => id !== state.anchorId) ?? "");
  const [error, setError] = useState("");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);

  const existingParent = state.type === "parent" && anchor ? anchor.parentIds.map((id) => byId.get(id)).find(Boolean) ?? null : null;
  const title =
    state.type === "child" ? `New child of ${anchor ? getFullName(anchor) : ""}${otherParent && byId.get(otherParent) ? ` & ${getFullName(byId.get(otherParent)!)}` : ""}`
    : state.type === "parent" ? `New parent of ${anchor ? getFullName(anchor) : ""}`
    : state.type === "spouse" ? `New spouse of ${anchor ? getFullName(anchor) : ""}`
    : state.type === "sibling" ? `New sibling of ${anchor ? getFullName(anchor) : ""}`
    : "Add the first person";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!given.trim() && !surname.trim()) { setError("Add a given name or a surname."); return; }
    const rb = parseDateInput(born), rd = parseDateInput(died), rm = parseDateInput(marriageYear);
    if (!rb.ok) { setError(`Born: ${rb.error}`); return; }
    if (!rd.ok) { setError(`Died: ${rd.error}`); return; }
    if (!rm.ok) { setError(`Married: ${rm.error}`); return; }
    if ((compareDates(rd.value, rb.value) ?? 0) < 0) { setError("The death date is before the birth date."); return; }
    const p: Person = {
      ...state.draft,
      givenName: given.trim(),
      surname: surname.trim(),
      name: [given.trim(), surname.trim()].filter(Boolean).join(" "),
      gender,
      birth: { date: rb.value, place: place.trim() },
      death: rd.value ? { date: rd.value, place: "" } : null,
    };
    onCreate(p, { marryExisting: marry, otherParent: otherParent || null, marriageYear: rm.value });
  };

  const input = inputCls, label = labelCls;
  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit} noValidate>
      <div className="grid flex-1 content-start gap-3 overflow-auto p-5">
        <h2 className="font-serif text-[22px] font-medium leading-tight">{title}</h2>
        {state.type !== "first" && <p className="-mt-1 text-[13px] text-ink-2">The dashed card on the canvas shows where they&apos;ll go.</p>}
        <div className="grid grid-cols-2 gap-2.5">
          <label className={label}>Given name<input ref={first} className={input} value={given} onChange={(e) => setGiven(e.target.value)} autoComplete="off" /></label>
          <label className={label}>Surname / initial<input className={input} value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="off" /></label>
        </div>
        <GenderPicker value={gender} onChange={setGender} />
        <div className="grid grid-cols-2 gap-2.5">
          <label className={label}>Born<input className={input} value={born} onChange={(e) => setBorn(e.target.value)} placeholder={DATE_PLACEHOLDER} /></label>
          <label className={label}>Died<input className={input} value={died} onChange={(e) => setDied(e.target.value)} placeholder="Leave empty if living" /></label>
        </div>
        <span className="-mt-1.5 text-[11.5px] text-ink-3">{DATE_HINT}</span>
        <label className={label}>Place<input className={input} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Town, district" /></label>
        {state.type === "child" && spouses.length > 0 && (
          <label className={label}>
            Other parent
            <select className={input} value={otherParent} onChange={(e) => setOtherParent(e.target.value)}>
              {spouses.map((s) => <option key={s.id} value={s.id}>{getFullName(s)}</option>)}
              <option value="">Not recorded</option>
            </select>
          </label>
        )}
        {state.type === "parent" && existingParent && (
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={marry} onChange={(e) => setMarry(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--brand))]" />
            Married to {getFullName(existingParent)}
          </label>
        )}
        {state.type === "spouse" && (
          <label className={label}>Married<input className={input} value={marriageYear} onChange={(e) => setMarriageYear(e.target.value)} placeholder="Year or date, optional" /></label>
        )}
        <p role="alert" className="text-[12.5px] text-brand">{error}</p>
      </div>
      <footer className="sticky bottom-0 flex gap-2 border-t border-rule bg-surface px-5 py-3">
        <button type="submit" className={`${btnPrimary} flex-1`}>Add to tree</button>
        <button type="button" className={btnPlain} onClick={onCancel}>Cancel</button>
      </footer>
    </form>
  );
}

function RelatePanel({ relate, people, byId, onGoto, onRelateSlot, onRelateSwap, onRelateClear, onRelateDone }: InspectorProps & { byId: Map<string, Person> }) {
  const a = relate.a ? byId.get(relate.a) : undefined;
  const b = relate.b ? byId.get(relate.b) : undefined;
  const result = a && b ? findRelationship(people, a, b) : null;
  const Slot = ({ which, p, placeholder }: { which: "a" | "b"; p?: Person; placeholder: string }) => (
    <button
      type="button"
      onClick={() => onRelateSlot(which)}
      aria-pressed={relate.slot === which}
      className={`flex min-h-14 flex-col justify-center rounded-[10px] border bg-card px-2.5 py-2 text-left ${relate.slot === which ? "border-brand shadow-[0_0_0_3px_hsl(var(--brand-wash))]" : "border-rule"}`}
    >
      <small className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">{which === "a" ? "Who's asking" : "About"}</small>
      {p ? <b className="font-serif text-base font-medium">{getFullName(p)}</b> : <span className="text-[13px] text-ink-3">{placeholder}</span>}
    </button>
  );
  return (
    <>
      <div className="flex-1 overflow-auto p-5">
        <h2 className="mb-1.5 font-serif text-[22px] font-medium">Relate two people</h2>
        <p className="mb-4 text-[13px] text-ink-2">Pick people on the canvas or in the list. Tamil kinship depends on who is asking, so order matters.</p>
        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
          <Slot which="a" p={a} placeholder="Click a person" />
          <button type="button" onClick={onRelateSwap} aria-label="Swap people" className="grid h-8 w-8 self-center place-items-center rounded-lg border border-rule bg-card text-ink-2">
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <Slot which="b" p={b} placeholder="Then another" />
        </div>
        {!result && <p className="rounded-[10px] border border-rule bg-card px-3.5 py-3 text-[13px] text-ink-2">Choose {a ? "a second person" : "two people"} on the canvas or in the people list.</p>}
        {result && a && b && (
          <div className="border-t border-rule pt-4" aria-live="polite">
            {result.related && result.path.length > 1 ? (
              <>
                <p className="text-[13.5px] text-ink-2"><b className="text-ink">{getFullName(b)}</b> is <b className="text-ink">{getFullName(a)}</b>&apos;s</p>
                <p className="mt-0.5 font-serif text-[30px] font-medium leading-tight">{result.english}</p>
                <p className="mt-1.5 font-tamil text-2xl font-semibold leading-snug" lang="ta">{result.tamil}</p>
                {result.address && <p className="mt-0.5 text-[13px] text-ink-2">Addressed as <span lang="ta" className="font-tamil font-semibold text-ink">{result.address}</span></p>}
                {result.gloss && <p className="mt-2.5 font-serif text-[15px] italic text-ink-3">{result.gloss[0].toUpperCase() + result.gloss.slice(1)}</p>}
                <ol className="mt-4 flex flex-wrap items-center gap-1 text-[12.5px]" aria-label="How they're connected">
                  <li><button type="button" onClick={() => onGoto(a.id)} className="rounded-full border border-rule bg-card px-2.5 py-0.5">{getFullName(a)}</button></li>
                  {result.steps.map((s, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="font-mono text-[10px] text-ink-3">{({ F: "father", M: "mother", P: "parent", S: "son", D: "daughter", C: "child", H: "husband", W: "wife", E: "spouse", B: "brother", Z: "sister", G: "sibling" } as Record<string, string>)[s.letter]} →</span>
                      <button type="button" onClick={() => onGoto(s.id)} className="rounded-full border border-rule bg-card px-2.5 py-0.5">{byId.get(s.id) ? getFullName(byId.get(s.id)!) : "?"}</button>
                    </li>
                  ))}
                </ol>
                {result.note && <p className="mt-4 border-l-2 border-brand pl-2.5 text-[12.5px] text-ink-2">{result.note}</p>}
              </>
            ) : (
              <p className="font-serif text-[22px] font-medium">{relationshipSentence(result, getFullName(a), getFullName(b))}</p>
            )}
          </div>
        )}
      </div>
      <footer className="sticky bottom-0 flex gap-2 border-t border-rule bg-surface px-5 py-3">
        <button type="button" className={`${btnPlain} flex-1`} onClick={onRelateClear}>Clear</button>
        <button type="button" className={btnPlain} onClick={onRelateDone}>Done</button>
      </footer>
    </>
  );
}
