"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Expand, Plus, X } from "lucide-react";
import { Marriage, Person, getFullName } from "@/lib/types";
import { canSetParents } from "@/lib/graph";
import { fileToDataUrl, firstGrapheme, isValidImageUrl } from "@/lib/avatar";
import { yearOf } from "@/lib/person-display";
import { DATE_HINT, DATE_PLACEHOLDER, compareDates, formatDate, parseDateInput } from "@/lib/dates";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageCropper } from "@/components/ImageCropper";
import { PhotoViewer } from "./PhotoViewer";
import { GenderPicker, btnGhost, btnPlain, btnPrimary, checkCls, hintCls, inputCls, labelCls, sectionTitle } from "./form";

interface PersonEditorProps {
  person: Person;
  people: Person[];
  onSave: (p: Person) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

const blankMarriage = (): Marriage => ({ spouseId: "", date: "", place: "", divorced: false, divorceDate: "", divorcePlace: "" });
const withYear = (p: Person) => `${getFullName(p)}${yearOf(p.birth?.date) ? ` · ${yearOf(p.birth?.date)}` : ""}`;
const byName = (a: Person, b: Person) => getFullName(a).localeCompare(getFullName(b));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-rule pt-3.5">
      <h3 className={`${sectionTitle} mb-0`}>{title}</h3>
      {children}
    </section>
  );
}

export function PersonEditor({ person: p, people, onSave, onCancel, onDelete }: PersonEditorProps) {
  const [given, setGiven] = useState(p.givenName || (!p.surname ? p.name : ""));
  const [surname, setSurname] = useState(p.surname);
  const [gender, setGender] = useState<Person["gender"]>(p.gender);
  const [occupation, setOccupation] = useState(p.occupation);
  const [notes, setNotes] = useState(p.notes);
  const [born, setBorn] = useState(formatDate(p.birth?.date));
  const [bornPlace, setBornPlace] = useState(p.birth?.place ?? "");
  const [deceased, setDeceased] = useState(!!p.death);
  const [died, setDied] = useState(formatDate(p.death?.date));
  const [diedPlace, setDiedPlace] = useState(p.death?.place ?? "");
  const [parents, setParents] = useState<[string, string]>([p.parentIds[0] ?? "", p.parentIds[1] ?? ""]);
  const [marriages, setMarriages] = useState<Marriage[]>(() =>
    p.spouseIds
      .map((id) => p.marriages.find((m) => m.spouseId === id) ?? { ...blankMarriage(), spouseId: id })
      .map((m) => ({ ...m, date: formatDate(m.date), divorceDate: formatDate(m.divorceDate) })),
  );
  const [avatar, setAvatar] = useState(p.avatarUrl ?? "");
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState(p.avatarUrl && !p.avatarUrl.startsWith("data:") ? p.avatarUrl : "");
  const [cropSrc, setCropSrc] = useState("");
  const [viewing, setViewing] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  const others = useMemo(() => people.filter((q) => q.id !== p.id).sort(byName), [people, p.id]);
  // Never offer someone who would become their own ancestor
  const parentOptions = useMemo(() => others.filter((q) => canSetParents(people, p.id, [q.id]).ok), [others, people, p.id]);

  const displayName = [given.trim(), surname.trim()].filter(Boolean).join(" ") || getFullName(p);

  // ---------- photo ----------
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("That file isn't an image."); return; }
    try { setCropSrc(await fileToDataUrl(file)); setError(""); } catch { setError("Couldn't read that image."); }
  };
  const applyLink = () => {
    const url = link.trim();
    if (!url) return;
    if (!isValidImageUrl(url)) { setError("The photo link must start with http:// or https://"); return; }
    setAvatar(url);
    setLinkOpen(false);
    setError("");
  };

  // ---------- marriages ----------
  const setMarriage = (i: number, patch: Partial<Marriage>) => setMarriages((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const g = given.trim(), s = surname.trim();
    if (!g && !s) { setError("Add a given name or a surname."); firstRef.current?.focus(); return; }
    // Every date: a year or DD-MM-YYYY; the first problem found is reported
    let bad = "";
    const parse = (label: string, v: string) => {
      const r = parseDateInput(v);
      if (!r.ok) { if (!bad) bad = `${label}: ${r.error}`; return ""; }
      return r.value;
    };
    const bornV = parse("Born", born);
    const diedV = deceased ? parse("Died", died) : "";
    const ms = marriages.filter((m) => m.spouseId).map((m) => ({
      ...m,
      date: parse("Married", m.date),
      divorceDate: m.divorced ? parse("Divorced", m.divorceDate) : "",
      divorcePlace: m.divorced ? m.divorcePlace : "",
    }));
    if (bad) { setError(bad); return; }
    if ((compareDates(diedV, bornV) ?? 0) < 0) { setError("The death date is before the birth date."); return; }
    const parentIds = parents.filter(Boolean).filter((id, i, a) => a.indexOf(id) === i);
    const check = canSetParents(people, p.id, parentIds);
    if (!check.ok) { setError(check.reason ?? "Those parents can't be set."); return; }
    onSave({
      ...p,
      givenName: g,
      surname: s,
      name: [g, s].filter(Boolean).join(" "),
      gender,
      occupation: occupation.trim(),
      notes: notes.trim(),
      birth: { date: bornV, place: bornPlace.trim() },
      death: deceased ? { date: diedV, place: diedPlace.trim() } : null,
      parentIds,
      spouseIds: ms.map((m) => m.spouseId),
      marriages: ms,
      avatarUrl: avatar || null,
    });
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={submit}
      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
      noValidate
    >
      <div className="grid flex-1 content-start gap-4 overflow-auto p-5">
        {/* ---------- header: portrait + name ---------- */}
        <header className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => (avatar ? setViewing(true) : fileRef.current?.click())}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pickPhoto(e.dataTransfer.files[0]); }}
            aria-label={avatar ? "View photo" : "Add a photo"}
            title={avatar ? "View photo (drop an image to replace it)" : "Click or drop an image"}
            className="group relative h-[72px] w-[72px] flex-none overflow-hidden rounded-full border border-rule bg-portrait focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden className="grid h-full w-full place-items-center font-serif text-[28px] text-ink-2">{firstGrapheme(displayName) || "?"}</span>
            )}
            <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {avatar ? <Expand className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
            </span>
          </button>
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">Editing</p>
            <h2 className="break-words font-serif text-[22px] font-medium leading-tight">{displayName}</h2>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[12.5px]">
              <button type="button" className="text-ink-2 underline decoration-rule underline-offset-4 hover:text-ink" onClick={() => fileRef.current?.click()}>{avatar ? "Change photo" : "Add photo"}</button>
              <button type="button" className="text-ink-2 underline decoration-rule underline-offset-4 hover:text-ink" onClick={() => setLinkOpen((o) => !o)} aria-expanded={linkOpen}>Use a link</button>
              {avatar && <button type="button" className="text-brand underline decoration-rule underline-offset-4" onClick={() => { setAvatar(""); setLink(""); }}>Remove</button>}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </header>
        {linkOpen && (
          <div className="-mt-1 flex gap-2">
            <input className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } }} placeholder="https://…/photo.jpg" aria-label="Photo link" />
            <button type="button" className={btnPlain} onClick={applyLink}>Use</button>
          </div>
        )}

        {/* ---------- identity ---------- */}
        <div className="grid grid-cols-2 gap-2.5">
          <label className={labelCls}>Given name<input ref={firstRef} className={inputCls} value={given} onChange={(e) => setGiven(e.target.value)} autoComplete="off" /></label>
          <label className={labelCls}>Surname / initial<input className={inputCls} value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="off" /></label>
        </div>
        <GenderPicker value={gender} onChange={setGender} name={`gender-${p.id}`} />
        <label className={labelCls}>Occupation<input className={inputCls} value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Farmer, teacher, …" /></label>

        {/* ---------- life ---------- */}
        <Section title="Life">
          <div className="grid grid-cols-2 gap-2.5">
            <label className={labelCls}>Born<input className={inputCls} value={born} onChange={(e) => setBorn(e.target.value)} placeholder={DATE_PLACEHOLDER} /></label>
            <label className={labelCls}>Birthplace<input className={inputCls} value={bornPlace} onChange={(e) => setBornPlace(e.target.value)} placeholder="Town, district" /></label>
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" className={checkCls} checked={deceased} onChange={(e) => setDeceased(e.target.checked)} />
            Has passed away
          </label>
          {deceased && (
            <div className="grid grid-cols-2 gap-2.5">
              <label className={labelCls}>Died<input className={inputCls} value={died} onChange={(e) => setDied(e.target.value)} placeholder="If known" /></label>
              <label className={labelCls}>Place<input className={inputCls} value={diedPlace} onChange={(e) => setDiedPlace(e.target.value)} placeholder="Optional" /></label>
            </div>
          )}
          <span className={`${hintCls} -mt-1`}>{DATE_HINT} Only the year shows on the tree.</span>
        </Section>

        {/* ---------- parents ---------- */}
        <Section title="Parents">
          <div className="grid grid-cols-2 gap-2.5">
            {([0, 1] as const).map((i) => (
              <label key={i} className={labelCls}>
                {i === 0 ? "Parent" : "Other parent"}
                <select className={inputCls} value={parents[i]} onChange={(e) => setParents((ps) => (i === 0 ? [e.target.value, ps[1]] : [ps[0], e.target.value]))}>
                  <option value="">Not recorded</option>
                  {parentOptions.filter((q) => q.id !== parents[1 - i]).map((q) => <option key={q.id} value={q.id}>{withYear(q)}</option>)}
                </select>
              </label>
            ))}
          </div>
        </Section>

        {/* ---------- marriages ---------- */}
        <Section title="Marriages">
          {marriages.length === 0 && <p className="-mt-1 text-[13px] text-ink-3">None recorded.</p>}
          {marriages.map((m, i) => {
            const taken = new Set(marriages.filter((_, j) => j !== i).map((mm) => mm.spouseId));
            return (
              <div key={i} className="grid gap-2.5 rounded-[10px] border border-rule bg-card p-3">
                <div className="flex items-end gap-2">
                  <label className={`${labelCls} flex-1`}>
                    Spouse
                    <select className={`${inputCls} bg-surface`} value={m.spouseId} onChange={(e) => setMarriage(i, { spouseId: e.target.value })}>
                      <option value="">Choose a person</option>
                      {others.filter((q) => !taken.has(q.id)).map((q) => <option key={q.id} value={q.id}>{withYear(q)}</option>)}
                    </select>
                  </label>
                  <button type="button" className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-3 hover:bg-rule-2 hover:text-brand" onClick={() => setMarriages((ms) => ms.filter((_, j) => j !== i))} aria-label={`Remove marriage ${i + 1}`} title="Remove this marriage">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className={labelCls}>Married<input className={`${inputCls} bg-surface`} value={m.date} onChange={(e) => setMarriage(i, { date: e.target.value })} placeholder="Year or date" /></label>
                  <label className={labelCls}>Place<input className={`${inputCls} bg-surface`} value={m.place} onChange={(e) => setMarriage(i, { place: e.target.value })} placeholder="Optional" /></label>
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" className={checkCls} checked={m.divorced} onChange={(e) => setMarriage(i, { divorced: e.target.checked })} />
                  Divorced or separated
                </label>
                {m.divorced && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className={labelCls}>When<input className={`${inputCls} bg-surface`} value={m.divorceDate} onChange={(e) => setMarriage(i, { divorceDate: e.target.value })} placeholder="Year or date" /></label>
                    <label className={labelCls}>Place<input className={`${inputCls} bg-surface`} value={m.divorcePlace} onChange={(e) => setMarriage(i, { divorcePlace: e.target.value })} placeholder="Optional" /></label>
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-rule text-[13px] text-ink-3 hover:border-brand hover:text-brand" onClick={() => setMarriages((ms) => [...ms, blankMarriage()])}>
            <Plus className="h-3.5 w-3.5" /> Add a marriage
          </button>
        </Section>

        {/* ---------- notes ---------- */}
        <Section title="Notes">
          <textarea
            className={`${inputCls} h-auto min-h-[96px] resize-y py-2 font-serif text-[15px] leading-relaxed`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Stories, nicknames, the village they came from…"
            aria-label="Notes"
          />
        </Section>

        <p role="alert" className="min-h-[1em] text-[12.5px] text-brand">{error}</p>
      </div>

      <footer className="sticky bottom-0 flex items-center gap-2 border-t border-rule bg-surface px-5 py-3">
        <button type="submit" className={`${btnPrimary} flex-1`}>Save changes</button>
        <button type="button" className={btnGhost} onClick={onCancel}>Cancel</button>
        <button type="button" className={`${btnPlain} text-brand`} onClick={() => onDelete(p.id)} aria-label={`Delete ${getFullName(p)}`}>Delete</button>
        <kbd className="font-mono text-[10.5px] text-ink-3 max-sm:hidden" title="Save with Ctrl+Enter">Ctrl ⏎</kbd>
      </footer>

      <PhotoViewer src={viewing ? avatar || null : null} name={displayName} onClose={() => setViewing(false)} />

      <Dialog open={!!cropSrc} onOpenChange={(o) => { if (!o) setCropSrc(""); }}>
        {/* Esc closes only the cropper, not the editor behind it */}
        <DialogContent className="max-w-[440px] gap-4 rounded-[14px] border-rule bg-surface max-sm:w-[calc(100%-32px)]" onEscapeKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-serif text-[21px] font-medium">Crop the photo</DialogTitle>
            <DialogDescription className="text-[13px] text-ink-2">Drag the circle over their face. It&apos;s saved small, so it stays in this browser and your backups.</DialogDescription>
          </DialogHeader>
          {cropSrc && (
            <ImageCropper
              imageSrc={cropSrc}
              onCropComplete={(url) => { setAvatar(url); setLink(""); setCropSrc(""); }}
              onCancel={() => setCropSrc("")}
              aspectRatio={1}
            />
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}
