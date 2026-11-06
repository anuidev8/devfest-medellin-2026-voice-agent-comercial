"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./Icon";

type Theme = "dark" | "light";

// The theme lives on <html> (set before paint in layout.tsx); this reads it as an external store.
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const getTheme = (): Theme => (document.documentElement.classList.contains("light") ? "light" : "dark");

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark" as Theme);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(next);
    try {
      localStorage.setItem("cva-theme", next);
    } catch {}
  };

  return (
    <button onClick={toggle} className="cbtn cbtn-sm" aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}
