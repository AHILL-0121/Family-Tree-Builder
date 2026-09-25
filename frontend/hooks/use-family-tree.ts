"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { HistoryAction, historyReducer, initialHistory } from "@/lib/graph";
import { loadTree, saveTree } from "@/lib/storage";
import { Person } from "@/lib/types";

export type SaveStatus = "loading" | "saved" | "saving" | "unsaved" | "error";

// Owns the family tree: relationship-safe reducer, undo/redo, and IndexedDB autosave.
export function useFamilyTree() {
  const [history, dispatchHistory] = useReducer(historyReducer, initialHistory);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const loaded = useRef(false);
  const skipNextSave = useRef(false);

  // Restore on mount
  useEffect(() => {
    let cancelled = false;
    loadTree().then((saved) => {
      if (cancelled) return;
      if (saved) {
        skipNextSave.current = true; // the restore itself is not a change to save
        dispatchHistory({ type: "load", people: saved.people });
        setSavedAt(saved.savedAt);
      }
      loaded.current = true;
      setStatus("saved");
    });
    return () => { cancelled = true; };
  }, []);

  // Debounced autosave after every change
  useEffect(() => {
    if (!loaded.current) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setStatus("unsaved");
    const timer = setTimeout(() => {
      setStatus("saving");
      saveTree(history.present)
        .then((at) => { setSavedAt(at); setStatus("saved"); })
        .catch(() => setStatus("error"));
    }, 500);
    return () => clearTimeout(timer);
  }, [history.present]);

  const dispatch = useCallback((action: HistoryAction) => dispatchHistory(action), []);
  const undo = useCallback(() => dispatchHistory({ type: "undo" }), []);
  const redo = useCallback(() => dispatchHistory({ type: "redo" }), []);

  return {
    people: history.present as Person[],
    dispatch,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    status,
    savedAt,
  };
}
