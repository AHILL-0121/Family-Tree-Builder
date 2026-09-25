"use client";

import React, { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from "d3-zoom";
import "d3-transition";
import { Person, Position, getFullName } from "@/lib/types";
import { layoutFamily, NODE_H, NODE_W, ROW_H, SPOUSE_GAP } from "@/lib/layout";
import { describePerson, initialOf, yearsLabel } from "@/lib/person-display";
import { fitName } from "@/lib/name-fit";

export type CanvasMode = "tree" | "desc" | "relate";
export type AddType = "parent" | "child" | "spouse" | "sibling";

export interface CanvasHandle {
  fit: () => void;
  centerOn: (id: string) => void;
  zoomBy: (factor: number) => void;
}

const DOUBLE_MS = 400;
// Full class names so Tailwind picks them up; "" (not recorded) has no ring
const RING: Record<Person["gender"], string> = { male: "stroke-gender-male", female: "stroke-gender-female", other: "stroke-gender-other", "": "" };

interface FamilyCanvasProps {
  people: Person[];
  pendingId: string | null;
  mode: CanvasMode;
  rootId: string | null;
  selectedId: string | null;
  relatePath: string[] | null;
  relateIds: (string | null)[];
  animateKey: string;
  onSelect: (id: string | null) => void;
  onActivate: (id: string) => void;
  onAdd: (type: AddType, anchorId: string) => void;
  onMove: (positions: Record<string, Position>) => void;
  onPickRelate: (id: string) => void;
  onZoomChange?: (k: number) => void;
  /** Pixels hidden at the bottom (the mobile bottom sheet); fit/center use the visible area */
  bottomInset?: number;
  /** Colour the portrait ring by recorded gender */
  genderRings?: boolean;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
// Names start after the portrait (x 58) and keep a 10px right margin
const NAME_X = 58, NAME_W = NODE_W - NAME_X - 10;
const YEARS_CHAR_W = 6.3; // Geist Mono at 10.5px: every glyph is the same width

// Text width in the card's serif (Newsreader 500), cached. Before the font family is known
// (server render, first paint) a deterministic estimate is used so hydration matches.
const widths = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null = null;
function measureName(text: string, px: number, family: string | null): number {
  if (!family) return text.length * px * 0.5;
  const key = `${family}|${px}|${text}`;
  let w = widths.get(key);
  if (w == null) {
    measureCtx ??= document.createElement("canvas").getContext("2d");
    if (!measureCtx) return text.length * px * 0.5;
    measureCtx.font = `500 ${px}px ${family}`;
    w = measureCtx.measureText(text).width;
    widths.set(key, w);
  }
  return w;
}

export const FamilyCanvas = forwardRef<CanvasHandle, FamilyCanvasProps>(function FamilyCanvas(props, ref) {
  const { people, pendingId, mode, rootId, selectedId, relatePath, relateIds, animateKey, genderRings = true } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  // Serif family for measuring names; re-read once web fonts have loaded
  const [nameFont, setNameFont] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      widths.clear();
      setNameFont(`${getComputedStyle(document.documentElement).getPropertyValue("--font-serif").trim() || "Georgia"}, Georgia, serif`);
    };
    read();
    let live = true;
    document.fonts?.ready.then(() => { if (live) read(); });
    return () => { live = false; };
  }, []);
  const worldRef = useRef<SVGGElement>(null);
  const patternRef = useRef<SVGPatternElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const patternId = useId().replace(/:/g, "");
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const layout = useMemo(() => layoutFamily(people, mode === "desc" && rootId ? { rootId } : {}), [people, mode, rootId]);

  // ---------- camera ----------
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 2.5])
      .filter((event: Event & { button?: number; ctrlKey?: boolean }) => {
        const target = event.target as Element | null;
        if (target?.closest?.("[data-node],[data-handle]")) return false;
        return (!event.ctrlKey || event.type === "wheel") && !event.button;
      })
      .on("zoom", (event: { transform: ZoomTransform }) => {
        transformRef.current = event.transform;
        const t = event.transform.toString();
        worldRef.current?.setAttribute("transform", t);
        patternRef.current?.setAttribute("patternTransform", t);
        props.onZoomChange?.(event.transform.k);
      });
    zoomRef.current = behavior;
    select(svg).call(behavior).on("dblclick.zoom", null);
    return () => { select(svg).on(".zoom", null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bottomInset = props.bottomInset ?? 0;
  const viewport = useCallback(() => {
    const r = svgRef.current?.getBoundingClientRect();
    return { w: r?.width || 800, h: Math.max(160, (r?.height || 600) - bottomInset) };
  }, [bottomInset]);
  const applyTransform = useCallback((t: ZoomTransform, animate = true) => {
    const svg = svgRef.current, z = zoomRef.current;
    if (!svg || !z) return;
    const sel = select(svg);
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) sel.transition().duration(350).call(z.transform, t);
    else sel.call(z.transform, t);
  }, []);
  const fit = useCallback(() => {
    const b = layout.bounds;
    if (!b) return;
    const { w, h } = viewport();
    const bw = b.maxX - b.minX + 160, bh = b.maxY - b.minY + 120;
    const k = Math.max(0.2, Math.min(1.1, (w - 48) / bw, (h - 110) / bh));
    applyTransform(zoomIdentity.translate(w / 2 - ((b.minX + b.maxX) / 2 - 30) * k, (h - 70) / 2 - ((b.minY + b.maxY) / 2) * k).scale(k));
  }, [layout.bounds, applyTransform, viewport]);
  const centerOn = useCallback((id: string) => {
    const n = layout.nodes.get(id);
    if (!n) return;
    const { w, h } = viewport(), k = transformRef.current.k;
    applyTransform(zoomIdentity.translate(w / 2 - (n.x + NODE_W / 2) * k, h / 2 - (n.y + NODE_H / 2) * k).scale(k));
  }, [layout.nodes, applyTransform, viewport]);
  const zoomBy = useCallback((factor: number) => {
    const svg = svgRef.current, z = zoomRef.current;
    if (svg && z) select(svg).transition().duration(200).call(z.scaleBy, factor);
  }, []);
  useImperativeHandle(ref, () => ({ fit, centerOn, zoomBy }), [fit, centerOn, zoomBy]);

  // Fit once when there is something to show and whenever the view (mode / root) changes.
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = `${mode}:${mode === "desc" ? rootId : ""}`;
    if (!layout.bounds || fittedFor.current === key) return;
    fittedFor.current = key;
    requestAnimationFrame(() => fit());
  }, [layout.bounds, mode, rootId, fit]);

  // ---------- drag (pointer events; committed once on release) ----------
  const drag = useRef<{ id: string; members: string[]; x: number; y: number; moved: boolean; pointerId: number } | null>(null);
  const [offset, setOffset] = useState<{ ids: Set<string>; dx: number; dy: number } | null>(null);
  // A press-and-release on empty paper (not a pan) clears the selection. Pointer capture
  // retargets "click" to the svg, so clicks can't tell background from node.
  const bgDown = useRef<{ x: number; y: number } | null>(null);
  // Same capture means dblclick never reaches the node either, so double-click / double-tap
  // is detected here: two clicks on the same person within DOUBLE_MS open their editor.
  const lastTap = useRef<{ id: string; t: number; x: number; y: number } | null>(null);

  const onNodePointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (mode === "relate") { props.onPickRelate(id); return; }
    const n = layout.nodes.get(id);
    if (!n || id === pendingId) return;
    const members = Array.from(layout.nodes.values()).filter((m) => m.unit === n.unit && m.id !== pendingId).map((m) => m.id);
    drag.current = { id, members, x: e.clientX, y: e.clientY, moved: false, pointerId: e.pointerId };
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const k = transformRef.current.k;
    const dx = (e.clientX - d.x) / k, dy = (e.clientY - d.y) / k;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
    d.moved = true;
    setOffset({ ids: new Set(d.members), dx, dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const bg = bgDown.current;
    bgDown.current = null;
    if (bg && Math.hypot(e.clientX - bg.x, e.clientY - bg.y) < 4 && mode !== "relate") props.onSelect(null);
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (d.moved && offset) {
      const positions: Record<string, Position> = {};
      for (const id of d.members) {
        const n = layout.nodes.get(id)!;
        positions[id] = { x: Math.round(n.x + offset.dx), y: Math.round(n.y + offset.dy) };
      }
      setOffset(null);
      props.onMove(positions);
    } else {
      setOffset(null);
      const prev = lastTap.current, now = e.timeStamp;
      if (prev && prev.id === d.id && now - prev.t < DOUBLE_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 12) {
        lastTap.current = null;
        props.onActivate(d.id);
      } else {
        lastTap.current = { id: d.id, t: now, x: e.clientX, y: e.clientY };
        props.onSelect(d.id);
      }
    }
  };

  // ---------- keyboard: move between relatives ----------
  const onNodeKeyDown = (e: React.KeyboardEvent, id: string) => {
    const p = byId.get(id), n = layout.nodes.get(id);
    if (!p || !n) return;
    let next: string | undefined;
    if (e.key === "ArrowUp") next = p.parentIds.find((q) => layout.nodes.has(q));
    else if (e.key === "ArrowDown") next = p.childIds.find((c) => layout.nodes.has(c));
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const row = Array.from(layout.nodes.values()).filter((o) => Math.abs(o.y - n.y) < 1).sort((a, b) => a.x - b.x);
      const i = row.findIndex((o) => o.id === id);
      next = row[i + (e.key === "ArrowLeft" ? -1 : 1)]?.id;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (mode === "relate") props.onPickRelate(id);
      else if (selectedId === id) props.onActivate(id);
      else props.onSelect(id);
      return;
    } else return;
    e.preventDefault();
    if (next) {
      if (mode !== "relate") props.onSelect(next);
      requestAnimationFrame(() => (svgRef.current?.querySelector(`[data-id="${CSS.escape(next!)}"]`) as SVGGElement | null)?.focus());
    }
  };

  // ---------- derived drawing data ----------
  const pos = (id: string) => {
    const n = layout.nodes.get(id)!;
    const o = offset && offset.ids.has(id) ? offset : null;
    return { x: n.x + (o?.dx ?? 0), y: n.y + (o?.dy ?? 0) };
  };
  const pathSet = useMemo(() => (relatePath && relatePath.length > 1 ? new Set(relatePath) : null), [relatePath]);
  const dim = (id: string) => (pathSet && !pathSet.has(id) ? "opacity-25" : "");
  const route = useMemo(() => {
    if (!pathSet || !relatePath) return "";
    let d = "";
    for (let i = 0; i < relatePath.length - 1; i++) {
      const a = layout.nodes.get(relatePath[i]), b = layout.nodes.get(relatePath[i + 1]);
      if (!a || !b) continue;
      if (Math.abs(a.y - b.y) < 1) { const l = a.x < b.x ? a : b, r = a.x < b.x ? b : a; d += `M${l.x + NODE_W} ${a.y + NODE_H / 2}H${r.x}`; }
      else { const up = a.y < b.y ? a : b, dn = a.y < b.y ? b : a; const mid = up.y + NODE_H + (dn.y - up.y - NODE_H) / 2; d += `M${up.x + NODE_W / 2} ${up.y + NODE_H}V${mid}H${dn.x + NODE_W / 2}V${dn.y}`; }
    }
    return d;
  }, [pathSet, relatePath, layout.nodes]);

  const selectedNode = selectedId ? layout.nodes.get(selectedId) : undefined;
  const selectedPerson = selectedId ? byId.get(selectedId) : undefined;
  const handles: { type: AddType; x: number; y: number; label: string }[] = [];
  if (selectedNode && selectedPerson && mode !== "relate" && !pendingId && !offset) {
    const s = pos(selectedNode.id);
    if (selectedPerson.parentIds.length < 2) handles.push({ type: "parent", x: s.x + NODE_W / 2, y: s.y - 16, label: "Add parent" });
    handles.push({ type: "child", x: s.x + NODE_W / 2, y: s.y + NODE_H + 16, label: "Add child" });
    const rowNodes = Array.from(layout.nodes.values()).filter((o) => Math.abs(o.y - selectedNode.y) < 1 && o.id !== selectedNode.id);
    const rightTaken = rowNodes.some((o) => o.x > selectedNode.x && o.x - (selectedNode.x + NODE_W) < SPOUSE_GAP + 2);
    const leftTaken = rowNodes.some((o) => o.x < selectedNode.x && selectedNode.x - (o.x + NODE_W) < SPOUSE_GAP + 2);
    if (!rightTaken) handles.push({ type: "spouse", x: s.x + NODE_W + 16, y: s.y + NODE_H / 2, label: "Add spouse" });
    else if (!leftTaken) handles.push({ type: "spouse", x: s.x - 16, y: s.y + NODE_H / 2, label: "Add spouse" });
  }
  const minX = layout.bounds?.minX ?? 0;
  const focusable = selectedId && layout.nodes.has(selectedId) ? selectedId : Array.from(layout.nodes.keys())[0];
  const ordered = Array.from(layout.nodes.values()).sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <svg
      ref={svgRef}
      className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      role="application"
      aria-roledescription="family tree"
      aria-label="Family tree. Tab to a person, then use the arrow keys to move between relatives and Enter to open them."
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; setOffset(null); }}
      onPointerDown={(e) => { if (!(e.target as Element).closest("[data-node],[data-handle]")) bgDown.current = { x: e.clientX, y: e.clientY }; }}
    >
      <defs>
        <pattern id={`dots-${patternId}`} ref={patternRef} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="fill-grid" />
        </pattern>
      </defs>
      <rect data-bg="" width="100%" height="100%" fill={`url(#dots-${patternId})`} />
      <g ref={worldRef}>
        {/* generation numerals */}
        {layout.generations.map((g) => (
          <text key={`gen-${g}`} x={minX - 44} y={g * ROW_H + NODE_H / 2 + 4} textAnchor="end" className={`fill-ink-3 font-mono text-[11px] tracking-[0.14em] ${pathSet ? "opacity-25" : ""}`}>
            {ROMAN[g] ?? g + 1}
          </text>
        ))}
        {/* descent lines */}
        {layout.descents.map((d) => (
          <path key={`d-${d.parents.join("-")}-${d.children.join("-")}`} d={offsetPath(d, offset)} className={`fill-none stroke-line ${pathSet ? "opacity-25" : ""}`} strokeWidth={1.25} strokeLinejoin="round" />
        ))}
        {/* marriage double rules */}
        {layout.bars.map((b) => {
          const a = pos(b.a), c = pos(b.b), y = a.y + NODE_H / 2;
          if (Math.abs(a.y - c.y) > 1) return null;
          return (
            <g key={`m-${b.a}-${b.b}`} className={pathSet ? "opacity-25" : ""}>
              <title>{b.divorced ? "Married (divorced)" : "Married"}</title>
              <line x1={a.x + NODE_W} x2={c.x} y1={y - 2.5} y2={y - 2.5} className="stroke-line" strokeWidth={1.25} strokeDasharray={b.divorced ? "4 3" : undefined} />
              <line x1={a.x + NODE_W} x2={c.x} y1={y + 2.5} y2={y + 2.5} className="stroke-line" strokeWidth={1.25} strokeDasharray={b.divorced ? "4 3" : undefined} />
            </g>
          );
        })}
        {/* relate route */}
        {route && <path d={route} className="fill-none stroke-brand" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
        {/* people */}
        {ordered.map((n) => {
          const p = byId.get(n.id);
          if (!p) return null;
          const { x, y } = pos(n.id);
          const pending = n.id === pendingId;
          const selected = mode === "relate" ? relateIds.includes(n.id) : selectedId === n.id;
          const onPath = !!pathSet?.has(n.id);
          const yrs = yearsLabel(p);
          const name = pending && !(p.givenName || p.surname).trim() ? "New person" : getFullName(p);
          return (
            <g
              key={n.id}
              data-node=""
              data-id={n.id}
              transform={`translate(${x},${y})`}
              tabIndex={n.id === focusable ? 0 : -1}
              role="button"
              aria-pressed={selected}
              aria-label={pending ? "New person, not saved yet" : describePerson(p, byId)}
              className={`group cursor-pointer outline-none ${dim(n.id)}`}
              onPointerDown={(e) => onNodePointerDown(e, n.id)}
              onKeyDown={(e) => onNodeKeyDown(e, n.id)}
            >
              <g key={`${animateKey}-${n.id}`} className="motion-safe:animate-[nodeIn_.45s_cubic-bezier(.2,.7,.2,1)_both]" style={{ animationDelay: `${Math.min(n.gen, 8) * 70}ms` }}>
                <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={13} className={`fill-none ${selected ? "stroke-brand/60" : "stroke-transparent group-focus-visible:stroke-brand"}`} strokeWidth={1.5} />
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  className={pending ? "fill-brand-wash stroke-brand" : `fill-card ${selected ? "stroke-ink" : onPath ? "stroke-brand" : "stroke-rule group-hover:stroke-line"}`}
                  strokeWidth={selected || onPath ? 1.5 : 1}
                  strokeDasharray={pending ? "4 3" : undefined}
                />
                {p.avatarUrl ? (
                  <>
                    <clipPath id={`av-${patternId}-${n.id}`}><circle cx={30} cy={30} r={18} /></clipPath>
                    <image href={p.avatarUrl} x={12} y={12} width={36} height={36} preserveAspectRatio="xMidYMid slice" clipPath={`url(#av-${patternId}-${n.id})`} />
                  </>
                ) : (
                  <>
                    <circle cx={30} cy={30} r={18} className="fill-portrait" />
                    <text x={30} y={35.5} textAnchor="middle" className="fill-ink-2 font-serif text-[15px]">{initialOf(p)}</text>
                  </>
                )}
                {genderRings && RING[p.gender] && <circle cx={30} cy={30} r={19.5} className={`fill-none ${RING[p.gender]}`} strokeWidth={2} />}
                <NameLabel name={name} yrs={yrs} font={nameFont} className={`font-serif font-medium ${pending ? "fill-brand italic" : p.death ? "fill-ink-2" : "fill-ink"}`} />
              </g>
            </g>
          );
        })}
        {/* quick-add handles on the selected person */}
        {handles.map((h) => (
          <g
            key={h.type}
            data-handle=""
            transform={`translate(${h.x},${h.y})`}
            role="button"
            tabIndex={0}
            aria-label={`${h.label} to ${selectedPerson ? getFullName(selectedPerson) : ""}`}
            className="group/h cursor-pointer outline-none"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); props.onAdd(h.type, selectedId!); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onAdd(h.type, selectedId!); } }}
          >
            <title>{h.label}</title>
            <circle r={11} className="fill-surface stroke-brand group-hover/h:fill-brand group-focus-visible/h:fill-brand" strokeWidth={1.25} />
            <path d="M-4.5 0h9M0 -4.5v9" className="stroke-brand group-hover/h:stroke-surface group-focus-visible/h:stroke-surface" strokeWidth={1.5} strokeLinecap="round" />
          </g>
        ))}
      </g>
    </svg>
  );
});

// Descent lines follow a drag in progress by shifting their end points
function offsetPath(d: { path: string; parents: string[]; children: string[] }, offset: { ids: Set<string>; dx: number; dy: number } | null) {
  if (!offset) return d.path;
  const moves = d.parents.some((id) => offset.ids.has(id)) || d.children.some((id) => offset.ids.has(id));
  return moves ? "" : d.path; // hide affected connectors while dragging; they redraw on release
}

// Name (1 or 2 lines, 15.5–13px) and the years line, laid out inside the card
function NameLabel({ name, yrs, font, className }: { name: string; yrs: string; font: string | null; className: string }) {
  const measure = (t: string, px: number) => measureName(t, px, font);
  const { size, lines } = fitName(name, NAME_W, measure);
  const years = (x: number, y: number) => <text x={x} y={y} className="fill-ink-3 font-mono text-[10.5px]">{yrs}</text>;

  if (lines.length === 1) {
    return (
      <>
        <text x={NAME_X} y={yrs ? 27 : 35} className={className} style={{ fontSize: size }}>{name}</text>
        {yrs && years(NAME_X, 45)}
      </>
    );
  }
  // Two lines: the years sit beside the second line when there's room, otherwise below
  const lh = size * 1.15;
  const gap = 6, yrsW = yrs.length * YEARS_CHAR_W;
  const line2W = measure(lines[1], size);
  const beside = !!yrs && line2W + gap + yrsW <= NAME_W;
  const stacked = !!yrs && !beside;
  const y1 = stacked ? 19 : 30 - lh / 2 + size * 0.35;
  const y2 = y1 + lh;
  return (
    <>
      <text x={NAME_X} y={y1} className={className} style={{ fontSize: size }}>{lines[0]}</text>
      <text x={NAME_X} y={y2} className={className} style={{ fontSize: size }}>{lines[1]}</text>
      {beside && years(NAME_X + line2W + gap, y2)}
      {stacked && years(NAME_X, y2 + 13)}
    </>
  );
}
