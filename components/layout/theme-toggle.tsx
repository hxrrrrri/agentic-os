"use client";

import { useEffect, useState } from "react";
import { Contrast, Moon, Sun } from "lucide-react";

type Theme = "dark" | "light" | "contrast";
const STORAGE_KEY = "agenticos-theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  // Persist as a cookie too — the server-rendered <html data-theme="…"> reads
  // this on the next navigation, so there's no flash and no inline init script.
  try {
    document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  } catch {}
}

function readStoredTheme(): Theme {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|; )agenticos-theme=(dark|light|contrast)/);
    if (match) return match[1] as Theme;
  }
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "dark" || stored === "light" || stored === "contrast") return stored;
    } catch {}
  }
  return "dark";
}

const options: Array<{ key: Theme; icon: typeof Sun; label: string; description: string }> = [
  { key: "dark", icon: Moon, label: "Dark", description: "AgenticOS terminal theme" },
  { key: "light", icon: Sun, label: "Light", description: "Warm light workspace" },
  { key: "contrast", icon: Contrast, label: "Contrast", description: "High contrast controls" },
];

export function useThemeSelection() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setSelectedTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  return { theme, setSelectedTheme, options };
}

export function ThemeToggle() {
  const { theme, setSelectedTheme } = useThemeSelection();

  return (
    <div className="inline-flex h-9 shrink-0 items-center gap-[2px] rounded-[3px] border border-[#333333] bg-[#151515] p-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(0,0,0,0.55)]">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSelectedTheme(opt.key)}
            aria-label={opt.label}
            title={opt.label}
            className={`inline-flex h-full w-8 items-center justify-center rounded-[2px] transition ${
              active ? "bg-[#241813] text-[#e97848]" : "text-[#8d877e] hover:text-[#f6efe5]"
            }`}
          >
            <Icon size={13} />
          </button>
        );
      })}
    </div>
  );
}

export function ThemeSelector() {
  const { theme, setSelectedTheme } = useThemeSelection();

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSelectedTheme(opt.key)}
            className={`group flex min-h-24 items-start gap-3 rounded-[4px] border p-3 text-left transition ${
              active
                ? "border-[#e86f3a] bg-[#1d1612] text-[#f4f1e8]"
                : "border-[#2a302c] bg-[#080a09] text-[#a8a29a] hover:border-[#e86f3a] hover:text-[#f4f1e8]"
            }`}
            aria-pressed={active}
          >
            <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border border-[#30342c] bg-[#10120f] text-[#e86f3a]">
              <Icon size={15} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#f4f1e8]">{opt.label}</span>
              <span className="mt-1 block text-xs leading-5 text-[#8b857b]">{opt.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
