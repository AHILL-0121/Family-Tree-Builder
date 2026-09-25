"use client";

import React from "react";

interface EmptyStateProps {
  onStart: () => void;
  onImport: () => void;
  onSample: () => void;
}

export function EmptyState({ onStart, onImport, onSample }: EmptyStateProps) {
  const options = [
    { title: "Start with yourself", body: "Then add parents, a spouse and children from the canvas.", onClick: onStart },
    { title: "Import a file", body: "A .json tree exported from this app.", onClick: onImport },
    { title: "Explore a sample", body: "Three generations and two families, with Tamil terms.", onClick: onSample },
  ];
  return (
    <div className="absolute inset-0 grid place-items-center p-6">
      <div className="max-w-[560px] text-center">
        <h2 className="mb-2 font-serif text-[34px] font-normal leading-tight tracking-tight">Every family starts with one name.</h2>
        <p className="mb-6 text-ink-2">Add the first person, bring in a file you exported before, or look around a sample family first.</p>
        <div className="grid gap-2.5 text-left sm:grid-cols-3">
          {options.map((o) => (
            <button key={o.title} type="button" onClick={o.onClick} className="flex flex-col gap-1.5 rounded-[10px] border border-rule bg-card p-3.5 text-left transition-colors hover:border-ink-3">
              <b className="font-serif text-[15px] font-medium">{o.title}</b>
              <span className="text-[12.5px] text-ink-3">{o.body}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-3">Everything stays in this browser until you export it.</p>
      </div>
    </div>
  );
}
