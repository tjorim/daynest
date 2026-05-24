import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setLanguageTag, languageTag } from "@/paraglide/runtime";
import type { AvailableLanguageTag } from "@/paraglide/runtime";

const STORAGE_KEY = "daynest_lang";

function detectLanguage(): AvailableLanguageTag {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "nl" || stored === "en") return stored;
  const browser = navigator.language.split("-")[0];
  return browser === "nl" ? "nl" : "en";
}

type LanguageContextValue = {
  language: AvailableLanguageTag;
  setLanguage: (tag: AvailableLanguageTag) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => undefined,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AvailableLanguageTag>(detectLanguage);

  useEffect(() => {
    setLanguageTag(language);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLanguage = useCallback((tag: AvailableLanguageTag) => {
    setLanguageTag(tag);
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

export { languageTag };
