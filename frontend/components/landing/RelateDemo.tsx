"use client";

import React, { useMemo, useState } from "react";
import { getFullName } from "@/lib/types";
import { samplePeople } from "@/lib/sample";
import { layoutFamily, NODE_H, NODE_W } from "@/lib/layout";
import { findRelationship } from "@/lib/relationships";
import { initialOf, yearsLabel } from "@/lib/person-display";

// Landing hero: the real layout + relationship engine on the sample family, read-only.
export function RelateDemo() {
  const people = useMemo(() => samplePeople(), []);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const layout = useMemo(() => layoutFamily(people), [people]);
  const [a, setA] = useState<string | null>("sample-vishal");
  const [b, setB] = useState<string | null>("sample-gopal");
  const result = a && b ? findRelationship(people, byId.get(a)!, byId.get(b)!) : null;
  const pathSet = result?.related && result.path.length > 1 ? new Set(result.path) : null;

  const pick = (id: string) => {
    if (!a || (a && b)) { setA(id); setB(null); }
    else if (id !== a) setB(id);
  };
  const bounds = layout.bounds!;
  const pad = 24;
  const vb = `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.maxX - bounds.minX + pad * 2} ${bounds.maxY - bounds.minY + pad * 2}`;

  let route = "";
  if (pathSet && result) {
    for (let i = 0; i < result.path.length - 1; i++) {
      const p = layout.nodes.get(result.path[i])!, q = layout.nodes.get(result.path[i + 1])!;
      if (Math.abs(p.y - q.y) < 1) { const l = p.x < q.x ? p : q, r = p.x < q.x ? q : p; route += `M${l.x + NODE_W} ${p.y + NODE_H / 2}H${r.x}`; }
      else { const up = p.y < q.y ? p : q, dn = p.y < q.y ? q : p; const mid = up.y + NODE_H + (dn.y - up.y - NODE_H) / 2; route += `M${up.x + NODE_W / 2} ${up.y + NODE_H}V${mid}H${dn.x + NODE_W / 2}V${dn.y}`; }
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-x-auto rounded-[14px] border border-rule bg-surface p-3">
        <svg viewBox={vb} className="h-auto w-full min-w-[640px]" role="group" aria-label="Sample family. Choose two people to see how they are related.">
          {layout.descents.map((d, i) => <path key={i} d={d.path} className={`fill-none stroke-line ${pathSet ? "opacity-30" : ""}`} strokeWidth={1.25} />)}
          {layout.bars.map((m) => (
            <g key={`${m.a}-${m.b}`} className={pathSet ? "opacity-30" : ""}>
              <line x1={m.x1} x2={m.x2} y1={m.y - 2.5} y2={m.y - 2.5} className="stroke-line" strokeWidth={1.25} />
              <line x1={m.x1} x2={m.x2} y1={m.y + 2.5} y2={m.y + 2.5} className="stroke-line" strokeWidth={1.25} />
            </g>
          ))}
          {route && <path d={route} className="fill-none stroke-brand" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
          {Array.from(layout.nodes.values()).map((n) => {
            const p = byId.get(n.id)!;
            const chosen = n.id === a || n.id === b;
            const dim = pathSet && !pathSet.has(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                role="button"
                tabIndex={0}
                aria-pressed={chosen}
                aria-label={getFullName(p)}
                className={`cursor-pointer outline-none ${dim ? "opacity-30" : ""}`}
                onClick={() => pick(n.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(n.id); } }}
              >
                <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={13} className={`fill-none ${chosen ? "stroke-brand/60" : "stroke-transparent"}`} strokeWidth={1.5} />
                <rect width={NODE_W} height={NODE_H} rx={10} className={`fill-card ${chosen ? "stroke-ink" : pathSet?.has(n.id) ? "stroke-brand" : "stroke-rule"}`} strokeWidth={chosen ? 1.5 : 1} />
                <circle cx={30} cy={30} r={18} className="fill-portrait" />
                <text x={30} y={35.5} textAnchor="middle" className="fill-ink-2 font-serif text-[15px]">{initialOf(p)}</text>
                <text x={58} y={27} className="fill-ink font-serif text-[15.5px] font-medium">{getFullName(p)}</text>
                <text x={58} y={45} className="fill-ink-3 font-mono text-[10.5px]">{yearsLabel(p)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-col justify-center rounded-[14px] border border-rule bg-card p-5" aria-live="polite">
        {result && a && b ? (
          <>
            <p className="text-[13.5px] text-ink-2"><b className="text-ink">{getFullName(byId.get(b)!)}</b> is <b className="text-ink">{getFullName(byId.get(a)!)}</b>&apos;s</p>
            <p className="mt-1 font-serif text-3xl font-medium">{result.english}</p>
            <p lang="ta" className="mt-1.5 font-tamil text-2xl font-semibold text-brand">{result.tamil}</p>
            {result.address && <p className="mt-1 text-[13px] text-ink-2">Addressed as <span lang="ta" className="font-tamil font-semibold text-ink">{result.address}</span></p>}
            {result.gloss && <p className="mt-3 font-serif italic text-ink-3">{result.gloss[0].toUpperCase() + result.gloss.slice(1)}</p>}
          </>
        ) : (
          <p className="font-serif text-xl text-ink-2">{a ? `Now choose someone ${getFullName(byId.get(a)!)} would ask about.` : "Choose who's asking."}</p>
        )}
        <p className="mt-5 text-xs text-ink-3">Tap any two people. The first is the one asking; Tamil kinship depends on who asks.</p>
      </div>
    </div>
  );
}
