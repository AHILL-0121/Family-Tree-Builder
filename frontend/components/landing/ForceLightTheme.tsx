"use client";

import { useEffect } from "react";
import { prefersDark } from "@/hooks/use-local-setting";

// The landing page is always light. On leaving it (client-side navigation to the editor),
// restore the saved or system theme, since the pre-paint script won't run again.
export function ForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    return () => {
      root.classList.toggle("dark", prefersDark());
    };
  }, []);
  return null;
}
