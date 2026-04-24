"use client";

import { Moon, Sparkles, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeName = "dark" | "light" | "lunar";

const THEMES: Array<{ id: ThemeName; label: string; icon: typeof Moon }> = [
  { id: "dark", label: "Темная", icon: Moon },
  { id: "light", label: "Светлая", icon: Sun },
  { id: "lunar", label: "Лунная", icon: Sparkles }
];

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("cognitive-theme") as ThemeName | null;
    const nextTheme = savedTheme ?? "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  function applyTheme(nextTheme: ThemeName) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("cognitive-theme", nextTheme);
  }

  return (
    <div className="theme-switcher" aria-label="Переключение темы">
      {THEMES.map(({ id, label, icon: Icon }) => (
        <button
          className={theme === id ? "theme-button active" : "theme-button"}
          key={id}
          onClick={() => applyTheme(id)}
          title={label}
          type="button"
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
