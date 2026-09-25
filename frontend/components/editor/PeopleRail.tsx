"use client";

import React, { forwardRef, useMemo, useState } from "react";
import { Download, Search, Upload } from "lucide-react";
import { Person, getFullName } from "@/lib/types";
import { computeGenerations } from "@/lib/layout";
import { byBirthYear, initialOf, yearOf } from "@/lib/person-display";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

interface PeopleRailProps {
  people: Person[];
  selectedId: string | null;
  visibleIds: Set<string>; // people drawn in the current view
  onPick: (id: string) => void;
  onImport: () => void;
  onExport: () => void;
}

export const PeopleRail = forwardRef<HTMLInputElement, PeopleRailProps>(function PeopleRail({ people, selectedId, visibleIds, onPick, onImport, onExport }, searchRef) {
  const [query, setQuery] = useState("");
  const gens = useMemo(() => computeGenerations(people), [people]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = people.filter((p) => !q || getFullName(p).toLowerCase().includes(q) || (p.birth?.place ?? "").toLowerCase().includes(q));
    const byGen = new Map<number, Person[]>();
    const elsewhere: Person[] = [];
    for (const p of match) {
      if (!visibleIds.has(p.id)) { elsewhere.push(p); continue; }
      const g = gens.get(p.id) ?? 0;
      if (!byGen.has(g)) byGen.set(g, []);
      byGen.get(g)!.push(p);
    }
    const out = Array.from(byGen.entries()).sort((a, b) => a[0] - b[0]).map(([g, list]) => ({ label: `Generation ${ROMAN[g] ?? g + 1}`, people: list.sort(byBirthYear) }));
    if (elsewhere.length) out.push({ label: "Not in this view", people: elsewhere.sort(byBirthYear) });
    return out;
  }, [people, query, gens, visibleIds]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 className="text-[13px] font-semibold">People</h2>
        <span className="font-mono text-xs text-ink-3">{people.length}</span>
      </div>
      <label className="mx-3 mb-2 flex h-[34px] items-center gap-2 rounded-lg border border-rule bg-card pl-2.5 pr-2 text-ink-3 focus-within:border-ink-3">
        <Search className="h-4 w-4 flex-none" aria-hidden />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people"
          aria-label="Search people"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
        <kbd className="rounded border border-b-2 border-rule bg-surface px-1.5 font-mono text-[11px] text-ink-3">/</kbd>
      </label>
      <nav className="min-h-0 flex-1 overflow-auto px-2 pb-4" aria-label="Family members">
        {groups.length === 0 && <p className="px-2 py-3 text-[13px] text-ink-3">{query ? `No one matches “${query}”.` : "No one yet."}</p>}
        {groups.map((g) => (
          <section key={g.label}>
            <h3 className="mx-2 mb-1 mt-3.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{g.label}</h3>
            <ul>
              {g.people.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p.id)}
                    aria-current={selectedId === p.id}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-rule-2 ${selectedId === p.id ? "bg-rule-2 shadow-[inset_0_0_0_1px_hsl(var(--rule))]" : ""}`}
                  >
                    <span aria-hidden className="grid h-6 w-6 flex-none place-items-center rounded-full bg-portrait font-serif text-xs text-ink-2">{initialOf(p)}</span>
                    <span className="min-w-0 flex-1 text-[13.5px] font-medium">{getFullName(p)}</span>
                    <span className="font-mono text-[11px] text-ink-3">{yearOf(p.birth?.date) ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <div className="grid grid-cols-2 gap-2 border-t border-rule p-3">
        <button type="button" onClick={onImport} className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rule bg-card text-[13px] font-medium hover:border-line">
          <Upload className="h-3.5 w-3.5" aria-hidden /> Import
        </button>
        <button type="button" onClick={onExport} disabled={!people.length} className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rule bg-card text-[13px] font-medium hover:border-line disabled:opacity-40">
          <Download className="h-3.5 w-3.5" aria-hidden /> Back up
        </button>
      </div>
    </div>
  );
});
