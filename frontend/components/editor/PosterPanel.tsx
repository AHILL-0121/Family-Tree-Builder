"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, ZoomBehavior } from "d3-zoom";
import "d3-transition";
import { ArrowLeft, Maximize, Minus, Plus, X } from "lucide-react";
import { Person, getFullName } from "@/lib/types";
import { buildPosterSVG, mainRoot, PAPER, paperDims, PosterOptions, posterPeopleCount } from "@/lib/poster";
import { embeddedPosterFonts } from "@/lib/poster-fonts";
import { downloadBlob, slug } from "@/lib/io";
import { imagePdf, unitsToPt } from "@/lib/pdf";
import { byBirthYear, yearOf } from "@/lib/person-display";
import { useToast } from "@/hooks/use-toast";

interface PosterPanelProps {
  open: boolean;
  people: Person[];
  treeName: string;
  selectedId: string | null;
  onClose: () => void;
  onBackup: () => void;
}

const zoomBtn = "grid h-7 w-7 place-items-center rounded-lg text-ink-2 hover:bg-rule-2 hover:text-ink";
const btn = "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[13px] font-medium disabled:opacity-40";

function Segmented<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <fieldset className="grid min-w-0 gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-[12.5px] text-ink-2">{label}</legend>
      <div className="flex overflow-hidden rounded-lg border border-rule bg-card" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <label key={v} className={`flex-1 cursor-pointer border-r border-rule px-0.5 py-[7px] text-center text-[12.5px] last:border-r-0 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand ${value === v ? "bg-ink text-surface" : "text-ink-2"} ${disabled ? "cursor-default opacity-55" : ""}`}>
            <input type="radio" className="sr-only" checked={value === v} onChange={() => onChange(v)} disabled={disabled} />
            {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PosterPanel({ open, people, treeName, selectedId, onClose, onBackup }: PosterPanelProps) {
  const { toast } = useToast();
  const sorted = useMemo(() => [...people].sort(byBirthYear), [people]);
  const [o, setO] = useState<PosterOptions>(() => ({
    title: treeName, style: "register", include: "whole", focus: null, rootId: null, dir: "top",
    labels: "names", anchor: null, size: "a4", orient: "landscape", foliage: "lush",
  }));
  const [animate, setAnimate] = useState(false);
  const [busy, setBusy] = useState<"" | "png" | "svg" | "pdf">("");
  const [zoomK, setZoomK] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // (Re)seed choices every time the panel opens
  useEffect(() => {
    if (!open) return;
    const youngest = sorted[sorted.length - 1]?.id ?? null;
    setO((prev) => ({
      ...prev,
      title: treeName || prev.title,
      focus: prev.focus && people.some((p) => p.id === prev.focus) ? prev.focus : selectedId ?? mainRoot(people),
      anchor: prev.anchor && people.some((p) => p.id === prev.anchor) ? prev.anchor : selectedId ?? youngest,
      rootId: mainRoot(people),
    }));
    setAnimate(true);
    requestAnimationFrame(() => closeRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ---------- preview camera: 100% = whole page fitted; scroll / pinch to zoom, drag to pan ----------
  useEffect(() => {
    const vp = viewportRef.current;
    if (!open || !vp) return;
    const behavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.5, 12])
      .filter((event: Event & { button?: number; ctrlKey?: boolean }) => (!event.ctrlKey || event.type === "wheel") && !event.button)
      .on("zoom", (event: { transform: { x: number; y: number; k: number } }) => {
        const { x, y, k } = event.transform;
        if (stageRef.current) stageRef.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
        setZoomK(k);
      });
    zoomRef.current = behavior;
    select(vp).call(behavior).on("dblclick.zoom", null);
    return () => { select(vp).on(".zoom", null); zoomRef.current = null; };
  }, [open]);
  const zoomBy = useCallback((factor: number) => {
    const vp = viewportRef.current, z = zoomRef.current;
    if (vp && z) select(vp).transition().duration(200).call(z.scaleBy, factor);
  }, []);
  const fitPage = useCallback((animate = true) => {
    const vp = viewportRef.current, z = zoomRef.current;
    if (!vp || !z) return;
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) select(vp).transition().duration(300).call(z.transform, zoomIdentity);
    else select(vp).call(z.transform, zoomIdentity);
  }, []);
  // A different page shape or a different tree: start again from the whole page
  useEffect(() => { if (open) fitPage(false); }, [open, o.size, o.orient, o.style, o.include, o.focus, fitPage]);

  const set = <K extends keyof PosterOptions>(k: K, v: PosterOptions[K], regrow = false) => {
    setO((prev) => {
      const next = { ...prev, [k]: v };
      // Illustrated always grows up from its trunk
      if (next.style === "illus") next.dir = next.include === "anc" ? "top" : "bottom";
      return next;
    });
    if (regrow) setAnimate(true);
  };

  const svg = useMemo(() => (open ? buildPosterSVG(people, { ...o, title: o.title.trim() || treeName || "Our family" }, "", { interactive: true, animate }) : ""), [open, people, o, animate, treeName]);
  useEffect(() => { if (animate) { const t = setTimeout(() => setAnimate(false), 2600); return () => clearTimeout(t); } }, [animate]);

  // Hover: keep the person's line to the trunk solid; click: see the tree through their eyes
  const trace = (id: string | null) => {
    const root = canvasRef.current?.querySelector("svg");
    if (!root) return;
    root.classList.toggle("tracing", !!id);
    root.querySelectorAll<SVGGElement>(".wood").forEach((g) => g.classList.toggle("on", !!id && (g.dataset.beyond ?? "").split(" ").includes(id)));
    root.querySelectorAll<SVGGElement>(".pcard").forEach((g) => {
      g.classList.toggle("on", !!id && (g.dataset.beyond ?? "").split(" ").includes(id));
      g.classList.toggle("hot", g.dataset.id === id);
    });
  };
  const pickAnchor = (id: string) => {
    setO((prev) => ({ ...prev, anchor: id, labels: prev.labels === "names" ? "tamil" : prev.labels }));
    const p = people.find((q) => q.id === id);
    if (p) toast({ title: `Relations as seen by ${getFullName(p)}` });
  };

  const opts = () => ({ ...o, title: o.title.trim() || treeName || "Our family" });
  const exportSVG = async () => {
    setBusy("svg");
    try {
      const { css, fonts } = await embeddedPosterFonts().catch(() => ({ css: "", fonts: undefined }));
      downloadBlob(new Blob([buildPosterSVG(people, opts(), css, { fonts })], { type: "image/svg+xml" }), `${slug(opts().title)}-${o.style}-${o.size}.svg`);
      toast({ title: "Saved SVG", description: "Opens in any browser and scales to any size." });
    } finally { setBusy(""); }
  };
  // Full-resolution render of the poster (300 dpi for paper sizes)
  const renderCanvas = async () => {
    const { css, fonts } = await embeddedPosterFonts().catch(() => ({ css: "", fonts: undefined }));
    const d = paperDims(o);
    const url = URL.createObjectURL(new Blob([buildPosterSVG(people, opts(), css, { fonts })], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      await new Promise((r) => setTimeout(r, 120));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(d.w * d.f);
      canvas.height = Math.round(d.h * d.f);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; // JPEG has no transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { canvas, d };
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const exportPNG = async () => {
    setBusy("png");
    try {
      const { canvas } = await renderCanvas();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("toBlob failed");
      downloadBlob(blob, `${slug(opts().title)}-${o.style}-${o.size}.png`);
      toast({ title: "Saved PNG", description: `${canvas.width} × ${canvas.height} px` });
    } catch {
      toast({ title: "Couldn't render the PNG", description: "Try the SVG download instead.", variant: "destructive" });
    } finally { setBusy(""); }
  };
  const exportPDF = async () => {
    setBusy("pdf");
    try {
      const { canvas, d } = await renderCanvas();
      const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      if (!jpeg) throw new Error("toBlob failed");
      const pdf = imagePdf({ jpeg: new Uint8Array(await jpeg.arrayBuffer()), width: canvas.width, height: canvas.height }, { w: unitsToPt(d.w), h: unitsToPt(d.h) }, opts().title);
      downloadBlob(pdf, `${slug(opts().title)}-${o.style}-${o.size}.pdf`);
      toast({ title: "Saved PDF", description: `${PAPER[o.size].name} ${o.orient}, print-ready at ${Math.round(d.f * 101.6)} dpi` });
    } catch {
      toast({ title: "Couldn't make the PDF", description: "Try the PNG or SVG download instead.", variant: "destructive" });
    } finally { setBusy(""); }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(0.8);
      else if (e.key === "0") fitPage();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose, zoomBy, fitPage]);

  if (!open) return null;
  const illus = o.style === "illus";
  const count = posterPeopleCount(svg);
  const d = paperDims(o);
  const tip = (o.size === "a4" || o.size === "phone") && count > 36 ? ` · ${count} people: A3 or larger reads best` : "";
  const personOptions = sorted.map((p) => <option key={p.id} value={p.id}>{getFullName(p)}{yearOf(p.birth?.date) ? ` · ${yearOf(p.birth?.date)}` : ""}</option>);
  const selectCls = "h-9 w-full min-w-0 rounded-lg border border-rule bg-card px-2.5 text-sm outline-none focus:border-ink-3";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="poster-title" className="fixed inset-0 z-50 grid grid-rows-[52px_minmax(0,1fr)_auto] bg-paper">
      <header className="flex items-center gap-3 border-b border-rule bg-surface pl-2 pr-3">
        <button ref={closeRef} type="button" onClick={onClose} title="Back to canvas (Esc)" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-ink-2 hover:bg-rule-2 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /><span className="max-sm:sr-only">Back to canvas</span>
        </button>
        <span aria-hidden className="h-5 w-px bg-rule" />
        <h2 id="poster-title" className="font-serif text-[19px] font-medium">Poster</h2>
        <span className="text-[12.5px] text-ink-3 max-md:hidden">Print it, frame it, send it to the family group.</span>
        <div className="flex-1" />
        <button type="button" onClick={onClose} aria-label="Close poster" title="Close (Esc)" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-rule-2"><X className="h-4 w-4" /></button>
      </header>
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] max-md:grid-cols-1 max-md:grid-rows-[42vh_minmax(0,1fr)]">
        <div ref={viewportRef} className={`relative min-h-0 min-w-0 touch-none overflow-hidden bg-[radial-gradient(hsl(var(--grid))_1px,transparent_1px)] [background-size:24px_24px] ${zoomK > 1.01 ? "cursor-grab active:cursor-grabbing" : ""}`}>
          {/* The stage carries the zoom transform; inside it the canvas is absolutely sized so the SVG letterboxes the whole page */}
          <div ref={stageRef} className="absolute inset-0 origin-top-left">
          <div
            ref={canvasRef}
            className="poster-canvas absolute inset-x-8 bottom-11 top-8 max-md:inset-x-4 max-md:bottom-10 max-md:top-4"
            aria-label="Poster preview"
            dangerouslySetInnerHTML={{ __html: svg }}
            onPointerOver={(e) => { const g = (e.target as Element).closest<SVGGElement>(".pcard"); trace(g?.dataset.id ?? null); }}
            onPointerLeave={() => trace(null)}
            onFocus={(e) => { const g = (e.target as Element).closest<SVGGElement>(".pcard"); if (g) trace(g.dataset.id ?? null); }}
            onBlur={() => trace(null)}
            onClick={(e) => { const g = (e.target as Element).closest<SVGGElement>(".pcard"); if (g?.dataset.id) pickAnchor(g.dataset.id); }}
            onKeyDown={(e) => { const g = (e.target as Element).closest<SVGGElement>(".pcard"); if (g?.dataset.id && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pickAnchor(g.dataset.id); } }}
          />
          </div>
          <div className="absolute right-3 top-3 flex items-center gap-0.5 rounded-[10px] border border-rule bg-surface p-0.5 shadow-sm" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
            <button type="button" className={zoomBtn} onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out (−)"><Minus className="h-4 w-4" /></button>
            <span className="min-w-[46px] text-center font-mono text-xs text-ink-2" aria-live="polite">{Math.round(zoomK * 100)}%</span>
            <button type="button" className={zoomBtn} onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in (+)"><Plus className="h-4 w-4" /></button>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-rule" />
            <button type="button" className={zoomBtn} onClick={() => fitPage()} aria-label="Fit whole page" title="Fit whole page (0)"><Maximize className="h-4 w-4" /></button>
          </div>
          <p className="absolute bottom-2 left-1/2 max-w-[calc(100%-24px)] -translate-x-1/2 truncate rounded-full border border-rule bg-surface px-3 py-0.5 text-xs text-ink-3">
            {"Scroll to zoom, drag to move · "}{illus ? "hover a person to trace their line · click to see the tree through their eyes" : "click a person to see the tree through their eyes"}
          </p>
        </div>
        <form className="grid content-start gap-4 overflow-auto border-l border-rule bg-surface p-5 max-md:border-l-0 max-md:border-t" onSubmit={(e) => e.preventDefault()}>
          <label className="grid gap-1.5 text-[12.5px] text-ink-2">Title
            <input className={selectCls} value={o.title} onChange={(e) => set("title", e.target.value)} />
          </label>
          <Segmented label="Style" value={o.style} options={[["register", "Register"], ["illus", "Illustrated"]]} onChange={(v) => set("style", v, true)} />
          <Segmented label="Who's on it" value={o.include} options={[["whole", "Branch"], ["desc", "Descendants"], ["anc", "Ancestors"]]} onChange={(v) => set("include", v, true)} />
          {o.include !== "whole" && (
            <label className="grid gap-1.5 text-[12.5px] text-ink-2">Of
              <select className={selectCls} value={o.focus ?? ""} onChange={(e) => set("focus", e.target.value, true)}>{personOptions}</select>
            </label>
          )}
          <div className="grid gap-1">
            <Segmented label="Oldest generation" value={o.dir} options={[["top", "At the top"], ["bottom", "At the roots"]]} onChange={(v) => set("dir", v)} disabled={illus} />
            {illus && <span className="text-[11.5px] text-ink-3">Illustrated always grows up from its trunk.</span>}
          </div>
          {illus && <Segmented label="Foliage" value={o.foliage} options={[["light", "Light"], ["lush", "Lush"], ["autumn", "Autumn"]]} onChange={(v) => set("foliage", v, true)} />}
          <Segmented label="Labels" value={o.labels} options={[["names", "Names"], ["tamil", "+ தமிழ்"], ["both", "+ Both"]]} onChange={(v) => set("labels", v)} />
          {o.labels !== "names" && (
            <label className="grid gap-1.5 text-[12.5px] text-ink-2">Relations as seen by
              <select className={selectCls} value={o.anchor ?? ""} onChange={(e) => set("anchor", e.target.value)}>{personOptions}</select>
              <span className="text-[11.5px] text-ink-3">Makes a lovely gift: every card says who they are to this person.</span>
            </label>
          )}
          <label className="grid gap-1.5 text-[12.5px] text-ink-2">Paper
            <select className={selectCls} value={o.size} onChange={(e) => set("size", e.target.value as PosterOptions["size"])}>
              <option value="a4">A4 · 300 dpi</option><option value="a3">A3 · 300 dpi</option><option value="a2">A2 · 200 dpi</option><option value="phone">Phone wallpaper</option>
            </select>
          </label>
          {o.size !== "phone" && <Segmented label="Orientation" value={o.orient} options={[["landscape", "Landscape"], ["portrait", "Portrait"]]} onChange={(v) => set("orient", v)} />}
          <p className="border-t border-rule pt-3 font-mono text-[11.5px] text-ink-3">{PAPER[o.size].name}{o.size === "phone" ? "" : ` ${o.orient}`} · {Math.round(d.w * d.f)} × {Math.round(d.h * d.f)} px{tip}</p>
        </form>
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t border-rule bg-surface px-4 py-3">
        <button type="button" className={`${btn} border-transparent hover:bg-rule-2`} onClick={onBackup}>Back up data (.json)</button>
        <div className="flex-1" />
        <button type="button" className={`${btn} border-rule bg-card hover:border-line`} onClick={exportSVG} disabled={!!busy}>{busy === "svg" ? "Preparing…" : "SVG"}</button>
        <button type="button" className={`${btn} border-rule bg-card hover:border-line`} onClick={exportPDF} disabled={!!busy || o.size === "phone"} title={o.size === "phone" ? "PDF is for paper sizes" : "Print-ready PDF at the paper size"}>{busy === "pdf" ? "Preparing…" : "PDF"}</button>
        <button type="button" className={`${btn} border-ink bg-ink text-surface hover:opacity-90`} onClick={exportPNG} disabled={!!busy}>{busy === "png" ? "Preparing…" : "Download PNG"}</button>
      </footer>
    </div>
  );
}
