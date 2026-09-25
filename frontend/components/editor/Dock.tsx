"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus, Redo2, Undo2 } from "lucide-react";
import type { CanvasMode } from "./FamilyCanvas";

const MODES: { id: CanvasMode; label: string }[] = [
  { id: "tree", label: "Tree" },
  { id: "desc", label: "Descendants" },
  { id: "relate", label: "Relate" },
];

interface DockProps {
  mode: CanvasMode;
  onMode: (m: CanvasMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoom: (factor: number) => void;
  onFit: () => void;
}

function IconButton({ label, shortcut, onClick, disabled, children, className = "" }: { label: string; shortcut?: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-8 w-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-rule-2 hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent ${className}`}
    >
      {children}
    </button>
  );
}

export function Dock({ mode, onMode, canUndo, canRedo, onUndo, onRedo, zoom, onZoom, onFit }: DockProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState({ left: 2, width: 0 });
  useLayoutEffect(() => {
    const el = refs.current[mode];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [mode]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = MODES.findIndex((m) => m.id === mode);
    const next = MODES[(i + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length].id;
    onMode(next);
    refs.current[next]?.focus();
  };

  return (
    <div role="toolbar" aria-label="Canvas tools" className="flex items-center gap-1 rounded-[14px] border border-rule bg-surface p-[5px] shadow-float">
      <div role="radiogroup" aria-label="View" className="relative flex rounded-[9px] bg-rule-2 p-[2px]" onKeyDown={onKeyDown}>
        <span aria-hidden className="absolute bottom-[2px] top-[2px] rounded-[7px] bg-card shadow-[0_0_0_1px_hsl(var(--rule))] transition-all duration-200" style={{ left: thumb.left, width: thumb.width }} />
        {MODES.map((m) => (
          <button
            key={m.id}
            ref={(el) => { refs.current[m.id] = el; }}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            tabIndex={mode === m.id ? 0 : -1}
            onClick={() => onMode(m.id)}
            className={`relative z-10 h-7 rounded-[7px] px-3 text-[13px] font-medium ${mode === m.id ? "text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <span aria-hidden className="mx-1 h-5 w-px bg-rule" />
      <IconButton label="Undo" shortcut="Ctrl+Z" onClick={onUndo} disabled={!canUndo}><Undo2 className="h-4 w-4" /></IconButton>
      <IconButton label="Redo" shortcut="Ctrl+Shift+Z" onClick={onRedo} disabled={!canRedo}><Redo2 className="h-4 w-4" /></IconButton>
      <span aria-hidden className="mx-1 h-5 w-px bg-rule" />
      <IconButton label="Zoom out" onClick={() => onZoom(1 / 1.2)} className="max-sm:hidden"><Minus className="h-4 w-4" /></IconButton>
      <span className="min-w-[44px] text-center font-mono text-xs text-ink-2 max-sm:hidden" aria-live="polite">{Math.round(zoom * 100)}%</span>
      <IconButton label="Zoom in" onClick={() => onZoom(1.2)} className="max-sm:hidden"><Plus className="h-4 w-4" /></IconButton>
      <IconButton label="Fit tree to screen" shortcut="F" onClick={onFit}><Maximize className="h-4 w-4" /></IconButton>
    </div>
  );
}
