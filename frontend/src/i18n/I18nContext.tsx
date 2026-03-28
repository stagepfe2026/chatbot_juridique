import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { claimCategoryTranslations, claimPriorityTranslations, claimStatusTranslations, documentCategoryTranslations, translations, type Language } from "./translations";
import type { ClaimCategory, ClaimPriority, ClaimStatus } from "../models/claim.models";
import type { DocumentCategory } from "../models/document.models";

type I18nContextValue = {
  language: Language;
  locale: string;
  dir: "ltr" | "rtl";
  setLanguage: (language: Language) => void;
  t: (key: string, fallback?: string) => string;
  claimCategoryLabel: (value: ClaimCategory) => string;
  claimPriorityLabel: (value: ClaimPriority) => string;
  claimStatusLabel: (value: ClaimStatus) => string;
  documentCategoryLabel: (value: DocumentCategory) => string;
};

const STORAGE_KEY = "app-language";
const localeByLanguage: Record<Language, string> = {
  fr: "fr-FR",
  en: "en-US",
  ar: "ar-MA",
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "fr";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "en" || raw === "ar" || raw === "fr" ? raw : "fr";
}

function resolveTranslation(language: Language, key: string): string | undefined {
  let current: unknown = translations[language];
  for (const part of key.split(".")) {
    if (!current || typeof current !== "object" || !(part in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>(() => getStoredLanguage());

  useEffect(() => {
    const next = user?.languePreferee;
    if (next === "fr" || next === "en" || next === "ar") {
      setLanguageState(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    }
  }, [user?.languePreferee]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const setLanguage = (next: Language) => {
      setLanguageState(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    };

    return {
      language,
      locale: localeByLanguage[language],
      dir: language === "ar" ? "rtl" : "ltr",
      setLanguage,
      t: (key: string, fallback?: string) => resolveTranslation(language, key) ?? fallback ?? key,
      claimCategoryLabel: (value: ClaimCategory) => claimCategoryTranslations[language][value] ?? value,
      claimPriorityLabel: (value: ClaimPriority) => claimPriorityTranslations[language][value] ?? value,
      claimStatusLabel: (value: ClaimStatus) => claimStatusTranslations[language][value] ?? value,
      documentCategoryLabel: (value: DocumentCategory) => documentCategoryTranslations[language][value] ?? value,
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }
  return context;
}
