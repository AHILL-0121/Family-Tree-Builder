"use client";

import { useCallback, useEffect, useState } from "react";

// Small per-browser conveniences (tree name, theme). Storage can be blocked or empty; the app
// must work without it.
export function useLocalSetting(key: string, fallback: string): [string, (v: string) => void] {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v != null) setValue(v);
    } catch {}
  }, [key]);
  const set = useCallback((v: string) => {
    setValue(v);
    try { localStorage.setItem(key, v); } catch {}
  }, [key]);
  return [value, set];
}

// Saved choice, else the system preference. Mirrors the pre-paint script in app/layout.tsx.
export function prefersDark(): boolean {
  try {
    const t = localStorage.getItem("ftb-theme");
    if (t) return t === "dark";
  } catch {}
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

export function toggleTheme() {
  const root = document.documentElement;
  const dark = !root.classList.contains("dark");
  root.classList.toggle("dark", dark);
  try { localStorage.setItem("ftb-theme", dark ? "dark" : "light"); } catch {}
}
