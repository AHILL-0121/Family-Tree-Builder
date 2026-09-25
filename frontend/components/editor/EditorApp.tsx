"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, Eraser, Moon, PanelLeft, PanelRight, Search, Users } from "lucide-react";
import { Person, Position, createEmptyPerson, getFullName } from "@/lib/types";
import { normalize } from "@/lib/graph";
import { layoutFamily } from "@/lib/layout";
import { findRelationship } from "@/lib/relationships";
import { mainRoot } from "@/lib/poster";
import { newId } from "@/lib/id";
import { describeImport } from "@/lib/json-schema";
import { exportJson, pickFile, readImportFile } from "@/lib/io";
import { samplePeople, SAMPLE_NAME } from "@/lib/sample";
import { useFamilyTree, SaveStatus } from "@/hooks/use-family-tree";
import { toggleTheme, useLocalSetting } from "@/hooks/use-local-setting";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { FamilyCanvas, CanvasHandle, CanvasMode, AddType } from "./FamilyCanvas";
import { Dock } from "./Dock";
import { PeopleRail } from "./PeopleRail";
import { Inspector, InspectorState } from "./Inspector";
import { CommandPalette, PaletteAction } from "./CommandPalette";
import { PosterPanel } from "./PosterPanel";
import { EmptyState } from "./EmptyState";
import { ClearTreeDialog } from "./ClearTreeDialog";

type Pending = { draft: Person; type: AddType | "first"; anchorId: string | null };

const SAVE_LABEL: Record<SaveStatus, string> = {
  loading: "Loading…",
  saved: "Saved in this browser",
  saving: "Saving…",
  unsaved: "Saving…",
  error: "Couldn't save: back up your data",
};

function BrandMark() {
  return (
    <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-[22px] w-[22px]" aria-hidden>
      <rect x="2" y="2.5" width="7" height="5" rx="1.2" /><rect x="13" y="2.5" width="7" height="5" rx="1.2" />
      <path d="M9 4.2h4M9 5.8h4M11 5v5.5M5.5 10.5h11M5.5 10.5V14M16.5 10.5V14" />
      <rect x="2" y="14" width="7" height="5" rx="1.2" /><rect x="13" y="14" width="7" height="5" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export function EditorApp() {
  const { toast } = useToast();
  const { people, dispatch, undo, redo, canUndo, canRedo, status } = useFamilyTree();
  const [treeName, setTreeName] = useLocalSetting("ftb-tree-name", "My family");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setModeState] = useState<CanvasMode>("tree");
  const [descRoot, setDescRoot] = useState<string | null>(null);
  const [relate, setRelate] = useState<{ a: string | null; b: string | null; slot: "a" | "b" }>({ a: null, b: null, slot: "a" });
  const [zoom, setZoom] = useState(1);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [showPeople, setShowPeople] = useLocalSetting("ftb-panel-people", "1");
  const [showDetails, setShowDetails] = useLocalSetting("ftb-panel-details", "1");
  const [genderRings, setGenderRings] = useLocalSetting("ftb-gender-rings", "1");
  const togglePeople = useCallback(() => setShowPeople(showPeople === "1" ? "0" : "1"), [showPeople, setShowPeople]);
  const toggleDetails = useCallback(() => setShowDetails(showDetails === "1" ? "0" : "1"), [showDetails, setShowDetails]);
  const [loadCount, setLoadCount] = useState(0);
  const canvas = useRef<CanvasHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  // Drop stale references after delete / undo / import
  useEffect(() => {
    if (selectedId && !byId.has(selectedId)) setSelectedId(null);
    if (editingId && !byId.has(editingId)) setEditingId(null);
    if (descRoot && !byId.has(descRoot)) setDescRoot(null);
    setRelate((r) => (r.a && !byId.has(r.a)) || (r.b && !byId.has(r.b)) ? { a: r.a && byId.has(r.a) ? r.a : null, b: r.b && byId.has(r.b) ? r.b : null, slot: "a" } : r);
  }, [byId, selectedId, editingId, descRoot]);

  // Warn only while something hasn't reached storage
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (status === "unsaved" || status === "saving" || status === "error") { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [status]);

  // People drawn on the canvas: the pending ghost joins the layout (not the data) until saved
  const canvasPeople = useMemo(() => (pending ? normalize([...people, pending.draft]).people : people), [people, pending]);
  const effectiveMode: CanvasMode = mode === "desc" && !descRoot ? "tree" : mode;
  const visibleIds = useMemo(() => new Set(layoutFamily(people, effectiveMode === "desc" && descRoot ? { rootId: descRoot } : {}).nodes.keys()), [people, effectiveMode, descRoot]);
  const relatePath = useMemo(() => {
    if (mode !== "relate" || !relate.a || !relate.b || !byId.has(relate.a) || !byId.has(relate.b)) return null;
    const r = findRelationship(people, byId.get(relate.a)!, byId.get(relate.b)!);
    return r.related ? r.path : null;
  }, [mode, relate, people, byId]);

  const inspectorState: InspectorState = pending
    ? { kind: "new", draft: pending.draft, type: pending.type, anchorId: pending.anchorId }
    : mode === "relate" ? { kind: "relate" }
    : editingId && byId.has(editingId) ? { kind: "edit", id: editingId }
    : selectedId && byId.has(selectedId) ? { kind: "person", id: selectedId }
    : { kind: "overview" };
  const sheetOpen = people.length > 0 && inspectorState.kind !== "overview";
  // Desktop panels: the details panel is forced open while adding, editing or relating
  const peopleVisible = showPeople === "1";
  const detailsVisible = showDetails === "1" || inspectorState.kind === "new" || inspectorState.kind === "edit" || inspectorState.kind === "relate";
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 900px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const bottomInset = narrow && sheetOpen && typeof window !== "undefined" ? window.innerHeight * 0.55 : 0;

  // ---------- actions ----------
  const select = useCallback((id: string | null) => {
    setPending(null);
    setEditingId(null);
    setSelectedId(id);
  }, []);

  const setMode = useCallback((m: CanvasMode) => {
    setPending(null);
    setEditingId(null);
    if (m === "desc") setDescRoot(selectedId ?? descRoot ?? mainRoot(people));
    if (m === "relate") setRelate({ a: selectedId, b: null, slot: selectedId ? "b" : "a" });
    setModeState(m);
  }, [selectedId, descRoot, people]);

  const goto = useCallback((id: string) => {
    setRailOpen(false);
    if (mode === "relate") {
      setRelate((r) => (r.slot === "a" ? { a: id, b: r.b === id ? null : r.b, slot: "b" } : id === r.a ? r : { ...r, b: id }));
      return;
    }
    if (mode === "desc" && !visibleIds.has(id)) setModeState("tree");
    select(id);
    requestAnimationFrame(() => canvas.current?.centerOn(id));
  }, [mode, visibleIds, select]);

  const pickRelate = useCallback((id: string) => {
    setRelate((r) => (r.slot === "a" ? { a: id, b: r.b === id ? null : r.b, slot: "b" } : id === r.a ? r : { ...r, b: id }));
  }, []);

  const startAdd = useCallback((type: AddType | "first", anchorId: string | null) => {
    const anchor = anchorId ? byId.get(anchorId) : undefined;
    const draft = createEmptyPerson(newId());
    if (type === "parent" && anchor) {
      if (anchor.parentIds.length >= 2) { toast({ title: "Already has two parents", description: `Edit ${getFullName(anchor)} to change them.` }); return; }
      draft.childIds = [anchor.id];
      if (anchor.parentIds.length === 1) draft.spouseIds = [anchor.parentIds[0]];
    } else if (type === "child" && anchor) {
      draft.parentIds = anchor.spouseIds.length ? [anchor.id, anchor.spouseIds[0]] : [anchor.id];
    } else if (type === "spouse" && anchor) {
      draft.spouseIds = [anchor.id];
    } else if (type === "sibling" && anchor) {
      if (!anchor.parentIds.length) {
        toast({
          title: "Add a parent first",
          description: `Siblings share a parent, and ${getFullName(anchor)} has none recorded yet.`,
          action: <ToastAction altText="Add a parent" onClick={() => startAddRef.current("parent", anchor.id)}>Add parent</ToastAction>,
        });
        return;
      }
      draft.parentIds = [...anchor.parentIds];
    }
    if (mode === "relate") setModeState("tree");
    setEditingId(null);
    setPending({ draft, type, anchorId });
    if (anchorId) setSelectedId(anchorId);
  }, [byId, mode, toast]);
  const startAddRef = useRef(startAdd);
  startAddRef.current = startAdd;

  const create = useCallback((p: Person, opts: { marryExisting: boolean; otherParent: string | null; marriageYear: string }) => {
    if (!pending) return;
    const person: Person = { ...p };
    const anchor = pending.anchorId;
    const blankMarriage = (spouseId: string, date = "") => ({ spouseId, date, place: "", divorced: false, divorceDate: "", divorcePlace: "" });
    if (pending.type === "child" && anchor) person.parentIds = opts.otherParent ? [anchor, opts.otherParent] : [anchor];
    if (pending.type === "parent") {
      const existing = person.spouseIds[0];
      if (!opts.marryExisting || !existing) person.spouseIds = [];
      else person.marriages = [blankMarriage(existing)];
    }
    if (pending.type === "spouse" && anchor) person.marriages = [blankMarriage(anchor, opts.marriageYear)];
    dispatch({ type: "addPerson", person });
    setPending(null);
    setSelectedId(person.id);
    toast({ title: `Added ${getFullName(person)}`, action: <ToastAction altText="Undo" onClick={undo}>Undo</ToastAction> });
    requestAnimationFrame(() => canvas.current?.centerOn(person.id));
  }, [pending, dispatch, toast, undo]);

  const saveEdit = useCallback((p: Person) => {
    dispatch({ type: "updatePerson", person: p });
    setEditingId(null);
    toast({ title: `Saved ${getFullName(p)}`, action: <ToastAction altText="Undo" onClick={undo}>Undo</ToastAction> });
  }, [dispatch, toast, undo]);

  const remove = useCallback((id: string) => {
    const p = byId.get(id);
    dispatch({ type: "deletePerson", id });
    setSelectedId(null);
    setEditingId(null);
    toast({ title: `Deleted ${p ? getFullName(p) : "person"}`, action: <ToastAction altText="Undo delete" onClick={undo}>Undo</ToastAction> });
  }, [byId, dispatch, toast, undo]);

  const move = useCallback((positions: Record<string, Position>) => {
    dispatch({ type: "setPositions", positions, coalesceKey: `drag-${newId()}` });
  }, [dispatch]);

  const replaceAll = useCallback((next: Person[], name: string | undefined, message: string, detail?: string) => {
    dispatch({ type: "replaceAll", people: next });
    if (name) setTreeName(name);
    select(null);
    setModeState("tree");
    setDescRoot(null);
    setLoadCount((n) => n + 1);
    toast({ title: message, description: detail || undefined, action: <ToastAction altText="Undo" onClick={undo}>Undo</ToastAction> });
  }, [dispatch, setTreeName, select, toast, undo]);

  const importFile = useCallback(async () => {
    const file = await pickFile();
    if (!file) return;
    const result = await readImportFile(file);
    if (!result.ok || !result.data) { toast({ title: "Import failed", description: result.error, variant: "destructive" }); return; }
    if (people.length && !window.confirm(`Replace the current tree (${people.length} people) with "${file.name}" (${result.data.people.length} people)? You can undo this.`)) return;
    replaceAll(result.data.people, result.name, `Imported ${result.data.people.length} people`, result.report ? describeImport(result.report) : undefined);
  }, [people.length, replaceAll, toast]);

  const loadSample = useCallback(() => {
    if (people.length && !window.confirm("Replace the current tree with the sample family? You can undo this.")) return;
    replaceAll(samplePeople(), SAMPLE_NAME, "Loaded the sample family");
  }, [people.length, replaceAll]);

  const backup = useCallback(() => {
    exportJson(people, treeName);
    toast({ title: "Backup downloaded", description: "Keep it somewhere safe; you can import it on any device." });
  }, [people, treeName, toast]);

  const clearTree = useCallback(() => {
    setClearOpen(false);
    setPending(null);
    replaceAll([], "My family", "Tree cleared", "Starting fresh.");
  }, [replaceAll]);

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (posterOpen || clearOpen) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); return; }
      if (paletteOpen) return;
      if (mod && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (e.key === "Escape") {
        if (pending) setPending(null);
        else if (editingId) setEditingId(null);
        else if (railOpen) setRailOpen(false);
        else if (mode === "relate") setModeState("tree");
        else if (selectedId) setSelectedId(null);
        return;
      }
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); setRailOpen(true); if (!peopleVisible) setShowPeople("1"); requestAnimationFrame(() => searchRef.current?.focus()); }
      else if (e.key === "[" && !mod) togglePeople();
      else if (e.key === "]" && !mod) toggleDetails();
      else if (e.key.toLowerCase() === "f" && !mod) canvas.current?.fit();
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedId && mode !== "relate" && !pending && !editingId) { e.preventDefault(); remove(selectedId); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [posterOpen, clearOpen, paletteOpen, pending, editingId, railOpen, mode, selectedId, undo, redo, remove, peopleVisible, setShowPeople, togglePeople, toggleDetails]);

  const actions: PaletteAction[] = [
    { label: "Tree view", hint: "mode", run: () => setMode("tree") },
    { label: "Descendants of the selected person", hint: "mode", run: () => setMode("desc") },
    { label: "Relate two people", hint: "mode", run: () => setMode("relate") },
    { label: "Fit tree to screen", hint: "F", run: () => canvas.current?.fit() },
    { label: "Make a poster (print, PNG, SVG)", hint: "export", run: () => setPosterOpen(true) },
    { label: "Back up data as JSON", hint: "file", run: backup },
    { label: "Import a family file", hint: "file", run: importFile },
    { label: "Add a person", hint: "new", run: () => startAdd("first", null) },
    { label: "Show / hide the people panel", hint: "[", run: togglePeople },
    { label: "Show / hide the details panel", hint: "]", run: toggleDetails },
    { label: "Toggle light / dark", hint: "theme", run: toggleTheme },
    { label: genderRings === "1" ? "Hide gender colours on portraits" : "Show gender colours on portraits", hint: "view", run: () => setGenderRings(genderRings === "1" ? "0" : "1") },
    { label: "Load the sample family", hint: "demo", run: loadSample },
    ...(people.length ? [{ label: "Clear the tree and start fresh", hint: "new", run: () => setClearOpen(true) }] : []),
  ];

  const descName = descRoot && byId.get(descRoot) ? getFullName(byId.get(descRoot)!) : "";
  const iconBtn = "grid h-8 w-8 place-items-center rounded-lg hover:bg-rule-2";

  return (
    <div className="grid h-dvh grid-rows-[52px_minmax(0,1fr)] bg-paper">
      {/* ---------- top bar ---------- */}
      <header className="flex items-center gap-3 border-b border-rule bg-surface pl-4 pr-3 max-[900px]:gap-2 max-[900px]:px-2">
        <button type="button" className={`${iconBtn} min-[901px]:hidden`} aria-label="People" aria-expanded={railOpen} onClick={() => setRailOpen((o) => !o)}>
          <Users className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`${iconBtn} max-[900px]:hidden ${peopleVisible ? "text-ink-2" : "bg-rule-2 text-ink"}`}
          aria-label={peopleVisible ? "Hide people panel" : "Show people panel"}
          aria-pressed={!peopleVisible}
          title={`${peopleVisible ? "Hide" : "Show"} people panel ([)`}
          onClick={togglePeople}
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <Link href="/" className="flex items-center gap-2.5 text-ink" aria-label="Family Tree Builder home">
          <BrandMark />
          <span className="whitespace-nowrap text-sm font-semibold tracking-tight max-sm:hidden">Family Tree Builder</span>
        </Link>
        <span aria-hidden className="text-ink-3 max-sm:hidden">/</span>
        <input
          value={treeName}
          onChange={(e) => setTreeName(e.target.value)}
          aria-label="Tree name"
          spellCheck={false}
          className="w-[16ch] min-w-0 max-w-[30vw] rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-serif text-[17px] italic hover:border-rule focus:border-ink-3 focus:bg-card focus:outline-none max-[900px]:w-[12ch]"
        />
        <div className="flex-1" />
        <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-3 max-[900px]:hidden" role="status">
          <span className={`h-1.5 w-1.5 rounded-full ${status === "error" ? "bg-brand" : status === "saved" ? "bg-ok" : "bg-amber-500"}`} />
          {SAVE_LABEL[status]}
        </span>
        <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Search people and actions" className="flex h-8 min-w-[190px] items-center justify-between gap-2 rounded-lg border border-rule bg-card px-3 text-[13px] text-ink-3 hover:border-line max-[1100px]:min-w-0 max-[900px]:w-8 max-[900px]:justify-center max-[900px]:px-0">
          <span className="flex items-center gap-2"><Search className="h-4 w-4" /><span className="max-[1100px]:hidden">Search</span></span>
          <kbd className="rounded border border-b-2 border-rule bg-surface px-1.5 font-mono text-[11px] max-[900px]:hidden">Ctrl K</kbd>
        </button>
        <button type="button" onClick={() => setPosterOpen(true)} disabled={!people.length} aria-label="Export, print or back up" className="flex h-8 items-center gap-1.5 rounded-lg border border-rule bg-card px-3 text-[13px] font-medium hover:border-line disabled:opacity-40 max-[900px]:w-8 max-[900px]:justify-center max-[900px]:px-0">
          <Download className="h-4 w-4" /><span className="max-[900px]:hidden">Export</span>
        </button>
        <button type="button" onClick={() => setClearOpen(true)} disabled={!people.length} aria-label="Clear the tree and start fresh" title="Clear canvas" className={`${iconBtn} text-ink-2 hover:text-brand disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-2`}>
          <Eraser className="h-4 w-4" />
        </button>
        <button type="button" onClick={toggleTheme} aria-label="Toggle colour theme" title="Theme" className={iconBtn}><Moon className="h-4 w-4" /></button>
        <button
          type="button"
          className={`${iconBtn} max-[900px]:hidden ${showDetails === "1" ? "text-ink-2" : "bg-rule-2 text-ink"}`}
          aria-label={showDetails === "1" ? "Hide details panel" : "Show details panel"}
          aria-pressed={showDetails !== "1"}
          title={`${showDetails === "1" ? "Hide" : "Show"} details panel (])`}
          onClick={toggleDetails}
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </header>

      {/* ---------- body ---------- */}
      <div
        className="editor-grid grid min-h-0 max-[900px]:grid-cols-1"
        style={{ "--rail-col": peopleVisible ? "var(--rail-w)" : "0px", "--insp-col": detailsVisible ? "var(--insp-w)" : "0px" } as React.CSSProperties}
      >
        <aside
          aria-label="People"
          className={`min-h-0 border-r border-rule bg-surface min-[901px]:col-start-1 min-[901px]:row-start-1 ${peopleVisible ? "" : "min-[901px]:hidden"} max-[900px]:fixed max-[900px]:bottom-0 max-[900px]:left-0 max-[900px]:top-[52px] max-[900px]:z-30 max-[900px]:w-[min(300px,86vw)] max-[900px]:shadow-float max-[900px]:transition-transform ${railOpen ? "" : "max-[900px]:-translate-x-[102%]"}`}
        >
          <PeopleRail ref={searchRef} people={people} selectedId={mode === "relate" ? relate.b ?? relate.a : selectedId} visibleIds={visibleIds} onPick={goto} onImport={importFile} onExport={backup} />
        </aside>

        <section className="relative min-h-0 min-w-0 overflow-hidden bg-paper min-[901px]:col-start-2 min-[901px]:row-start-1" aria-label="Family tree canvas">
          {people.length === 0 && !pending ? (
            <EmptyState onStart={() => startAdd("first", null)} onImport={importFile} onSample={loadSample} />
          ) : (
            <FamilyCanvas
              ref={canvas}
              people={canvasPeople}
              pendingId={pending?.draft.id ?? null}
              mode={effectiveMode}
              rootId={descRoot}
              selectedId={pending ? pending.draft.id : selectedId}
              relatePath={relatePath}
              relateIds={[relate.a, relate.b]}
              animateKey={`${effectiveMode}-${effectiveMode === "desc" ? descRoot : ""}-${loadCount}`}
              onSelect={(id) => {
                // A click on the person being edited keeps the form (and its unsaved changes) open
                if (id && id === editingId) return;
                select(id);
                if (id && narrow) requestAnimationFrame(() => canvas.current?.centerOn(id));
              }}
              onActivate={(id) => { setSelectedId(id); setEditingId(id); }}
              onAdd={(t, id) => startAdd(t, id)}
              onMove={move}
              onPickRelate={pickRelate}
              onZoomChange={setZoom}
              bottomInset={bottomInset}
              genderRings={genderRings === "1"}
            />
          )}
          {effectiveMode === "desc" && descName && (
            <div className="absolute left-3.5 top-3.5 flex items-center gap-2 rounded-[10px] border border-rule bg-surface py-1.5 pl-3 pr-1.5 text-[13px] shadow-float">
              <span>Descendants of <b className="font-serif text-[15px] font-medium">{descName}</b></span>
              <button type="button" onClick={() => setMode("tree")} className="h-7 rounded-lg px-2.5 hover:bg-rule-2">Whole tree</button>
            </div>
          )}
          {people.length > 0 && (
            <div className={`absolute left-1/2 -translate-x-1/2 transition-[bottom] ${sheetOpen ? "bottom-[18px] max-[900px]:bottom-[calc(55vh+12px)]" : "bottom-[18px]"}`}>
              <Dock mode={mode} onMode={setMode} canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} zoom={zoom} onZoom={(f) => canvas.current?.zoomBy(f)} onFit={() => canvas.current?.fit()} />
            </div>
          )}
        </section>

        <aside
          aria-label="Details"
          className={`flex min-h-0 flex-col overflow-auto border-l border-rule bg-surface min-[901px]:col-start-3 min-[901px]:row-start-1 ${detailsVisible ? "" : "min-[901px]:hidden"} max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-20 max-[900px]:max-h-[55vh] max-[900px]:rounded-t-[14px] max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:shadow-float max-[900px]:transition-transform ${sheetOpen ? "" : "max-[900px]:translate-y-[102%]"}`}
        >
          <Inspector
            state={inspectorState}
            people={people}
            treeName={treeName}
            relate={relate}
            onGoto={goto}
            onAdd={(t, id) => startAdd(t, id)}
            onEdit={(id) => setEditingId(id)}
            onDelete={remove}
            onStartRelate={(id) => { setRelate({ a: id, b: null, slot: "b" }); setPending(null); setEditingId(null); setModeState("relate"); }}
            onSaveEdit={saveEdit}
            onCancel={() => { setPending(null); setEditingId(null); }}
            onCreate={create}
            onRelateSlot={(slot) => setRelate((r) => ({ ...r, slot }))}
            onRelateSwap={() => setRelate((r) => ({ a: r.b, b: r.a, slot: r.slot }))}
            onRelateClear={() => setRelate({ a: null, b: null, slot: "a" })}
            onRelateDone={() => { const keep = relate.b ?? relate.a; setModeState("tree"); if (keep) setSelectedId(keep); }}
          />
        </aside>
      </div>

      {railOpen && <div className="fixed inset-0 top-[52px] z-20 bg-[rgb(20_19_17/0.2)] min-[901px]:hidden" onClick={() => setRailOpen(false)} aria-hidden />}
      <CommandPalette open={paletteOpen} people={people} actions={actions} onPerson={goto} onClose={() => setPaletteOpen(false)} />
      <ClearTreeDialog open={clearOpen} count={people.length} treeName={treeName} onOpenChange={setClearOpen} onBackup={backup} onConfirm={clearTree} />
      <PosterPanel open={posterOpen} people={people} treeName={treeName} selectedId={selectedId} onClose={() => setPosterOpen(false)} onBackup={backup} />
    </div>
  );
}
