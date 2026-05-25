import { createContext, useContext, useState, useCallback } from "react";
import { setLocale, getLocale } from "@/paraglide/runtime";
import type { Locale } from "@/paraglide/runtime";

const STORAGE_KEY = "daynest_lang";

function detectLanguage(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "nl" || stored === "en") return stored;
  const browser = navigator.language.split("-")[0];
  return browser === "nl" ? "nl" : "en";
}

type LanguageContextValue = {
  language: Locale;
  setLanguage: (tag: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => undefined,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Locale>(() => {
    const initial = detectLanguage();
    setLocale(initial, { reload: false });
    return initial;
  });

  const setLanguage = useCallback((tag: Locale) => {
    setLocale(tag, { reload: false });
    localStorage.setItem(STORAGE_KEY, tag);
    setLanguageState(tag);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export { getLocale };
