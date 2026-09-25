"use client";

import { Person } from "@/lib/types";

// Shared look for the inspector's forms (new person, edit person)
export const btn = "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[13px] font-medium transition-colors disabled:opacity-40";
export const btnPlain = `${btn} border-rule bg-card hover:border-line`;
export const btnPrimary = `${btn} border-ink bg-ink text-surface hover:opacity-90`;
export const btnBrand = `${btn} border-brand bg-brand text-white dark:text-ink`;
export const btnGhost = `${btn} border-transparent text-ink-2 hover:bg-rule-2 hover:text-ink`;
export const sectionTitle = "mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3";
export const inputCls = "h-9 w-full min-w-0 rounded-lg border border-rule bg-card px-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-ink-3 focus:shadow-[0_0_0_3px_hsl(var(--rule-2))]";
export const labelCls = "grid min-w-0 gap-1 text-[12.5px] text-ink-2";
export const hintCls = "text-[11.5px] text-ink-3";
export const checkCls = "h-4 w-4 accent-[hsl(var(--brand))]";

const GENDERS: [Person["gender"], string][] = [["female", "Female"], ["male", "Male"], ["other", "Other"], ["", "Unknown"]];

export function GenderPicker({ value, onChange, name = "gender" }: { value: Person["gender"]; onChange: (g: Person["gender"]) => void; name?: string }) {
  return (
    <fieldset className={labelCls}>
      <legend className="mb-1">Gender</legend>
      <div className="flex overflow-hidden rounded-lg border border-rule bg-card" role="radiogroup" aria-label="Gender">
        {GENDERS.map(([v, l]) => (
          <label key={l} className={`flex-1 cursor-pointer border-r border-rule py-[7px] text-center text-[12.5px] last:border-r-0 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand ${value === v ? "bg-ink text-surface" : "text-ink-2"}`}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
            {l}
          </label>
        ))}
      </div>
      <span className={hintCls}>Chooses the kinship words, and the portrait ring: blue, pink or grey. Unknown has none.</span>
    </fieldset>
  );
}
