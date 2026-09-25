"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Person, getFullName } from "@/lib/types";
import { byBirthYear, initialOf, yearOf } from "@/lib/person-display";

export interface PaletteAction {
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  people: Person[];
  actions: PaletteAction[];
  onPerson: (id: string) => void;
  onClose: () => void;
}

export function CommandPalette({ open, people, actions, onPerson, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const prev = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => prev?.focus?.();
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ppl = people
      .filter((p) => !q || getFullName(p).toLowerCase().includes(q))
      .sort(byBirthYear)
      .slice(0, 8)
      .map((p) => ({ kind: "person" as const, key: p.id, label: getFullName(p), hint: String(yearOf(p.birth?.date) ?? ""), person: p, run: () => onPerson(p.id) }));
    const acts = actions.filter((a) => !q || a.label.toLowerCase().includes(q)).map((a) => ({ kind: "action" as const, key: a.label, label: a.label, hint: a.hint ?? "", person: null, run: a.run }));
    return [...ppl, ...acts];
  }, [query, people, actions, onPerson]);

  useEffect(() => { setIndex((i) => Math.min(i, Math.max(0, items.length - 1))); }, [items.length]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest" }); }, [index]);

  if (!open) return null;
  const run = (i: number) => { const it = items[i]; if (!it) return; onClose(); it.run(); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(index); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };
  const peopleCount = items.filter((i) => i.kind === "person").length;

  return (
    <div className="fixed inset-0 z-40" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-[rgb(20_19_17/0.28)]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="absolute left-1/2 top-[12vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[14px] border border-rule bg-surface shadow-float">
        <div className="flex items-center gap-2.5 border-b border-rule px-3.5 text-ink-3">
          <Search className="h-4 w-4" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
            placeholder="Jump to a person or run an action…"
            aria-label="Search"
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={items[index] ? `pal-${index}` : undefined}
            className="h-[50px] flex-1 bg-transparent text-[15px] text-ink outline-none"
          />
          <kbd className="rounded border border-b-2 border-rule bg-surface px-1.5 font-mono text-[11px]">esc</kbd>
        </div>
        <div ref={listRef} id="palette-list" role="listbox" className="max-h-[min(52vh,420px)] overflow-auto p-1.5">
          {items.length === 0 && <p className="p-4 text-center text-ink-3">Nothing matches “{query}”.</p>}
          {items.map((it, i) => (
            <React.Fragment key={`${it.kind}-${it.key}`}>
              {i === 0 && peopleCount > 0 && <p className="px-2.5 pb-1 pt-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">People</p>}
              {i === peopleCount && it.kind === "action" && <p className="px-2.5 pb-1 pt-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">Actions</p>}
              <button
                type="button"
                id={`pal-${i}`}
                data-i={i}
                role="option"
                aria-selected={i === index}
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(i)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${i === index ? "bg-rule-2" : ""}`}
              >
                {it.person && <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-portrait font-serif text-xs text-ink-2">{initialOf(it.person)}</span>}
                <span className="flex-1">{it.label}</span>
                <span className="font-mono text-[11px] text-ink-3">{it.hint}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
