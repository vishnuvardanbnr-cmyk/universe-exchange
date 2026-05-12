import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { translate, LanguageCode, isLanguageCode } from "@/lib/i18n";

interface I18nContextValue {
  lang: LanguageCode;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  t: (key) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const lang: LanguageCode = isLanguageCode(user?.language) ? user!.language as LanguageCode : "en";
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );
  const value = useMemo(() => ({ lang, t }), [lang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
