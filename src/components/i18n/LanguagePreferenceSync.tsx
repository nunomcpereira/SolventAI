"use client";

import { useEffect } from "react";
import { type Language } from "../../lib/i18n/locales.js";

const LANGUAGE_STORAGE_KEY = "solventai.language";

export function LanguagePreferenceSync({ lang }: { lang: Language }) {
  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors (private mode or blocked storage).
    }
  }, [lang]);

  return null;
}
