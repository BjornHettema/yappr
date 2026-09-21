"use client";

import { useEffect, useState } from "react";
import { THEME_KEY } from "@/lib/types";

/**
 * Light/dark switch.
 *
 * Until someone picks a side, the site follows the operating system and keeps
 * following it, so a phone that flips to dark at sunset takes the site with it.
 * The moment they choose, that choice is stored and the system stops deciding.
 *
 * The theme itself is set before first paint by the inline script in
 * `app/layout.tsx`; this component only reads and changes it. It renders a
 * stable label on the server and corrects itself on mount, because the real
 * value lives in localStorage and the OS, neither of which the server can see.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    setReady(true);

    // Keep following the OS for as long as no explicit choice has been stored.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = (event: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch {
        /* private mode, blocked storage: just follow the system */
      }
      if (stored === "light" || stored === "dark") return;
      document.documentElement.dataset.theme = event.matches ? "dark" : "light";
      setDark(event.matches);
    };

    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setDark(!dark);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* the theme still applies for this visit, it just won't be remembered */
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      // Nothing is known about the theme until mount, so don't announce a
      // state that might be wrong for a beat.
      aria-pressed={ready ? dark : undefined}
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}
