import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "daynest-theme";
const THEME_CYCLE: Theme[] = ["auto", "light", "dark"];

function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }
  return "auto";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== "auto") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// data-bs-theme on <html> is the single switch: Bootstrap, the Tailwind `dark:` variant, the design
// tokens and the calendar all follow it.
function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute("data-bs-theme", resolved);
  return resolved;
}

interface ThemeContextValue {
  theme: Theme;
  /** The light/dark value actually applied, with `auto` resolved against the OS. */
  resolvedTheme: ResolvedTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));

  useLayoutEffect(() => {
    setResolvedTheme(applyTheme(theme));
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme === "auto") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => setResolvedTheme(applyTheme("auto"));
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => THEME_CYCLE[(THEME_CYCLE.indexOf(prev) + 1) % THEME_CYCLE.length]!);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
