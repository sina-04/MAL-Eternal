"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LOCALE_STORAGE_KEY, translate, type Locale, type MessageKey } from "../lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === "fa" || saved === "en") setLocaleState(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
    document.title = locale === "fa" ? "مَل اترنال — فهرست دستاوردهای من" : "MAL Eternal — My Achievements List";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);
  const t = useCallback((key: MessageKey, values?: Record<string, string | number>) => translate(locale, key, values), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}

export function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="language-switch" role="group" aria-label={t("language")}>
      <button type="button" lang="en" className={locale === "en" ? "language-switch--active" : ""} aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
      <span aria-hidden="true" />
      <button type="button" lang="fa" dir="rtl" className={`language-switch__persian ${locale === "fa" ? "language-switch--active" : ""}`} aria-pressed={locale === "fa"} onClick={() => setLocale("fa")}>فارسی</button>
    </div>
  );
}
