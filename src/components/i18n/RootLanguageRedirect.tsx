"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { type Language, SUPPORTED_LANGUAGES } from "../../lib/i18n/locales.js";

const LANGUAGE_STORAGE_KEY = "solventai.language";

function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function RootLanguageRedirect({ fallbackLanguage }: { fallbackLanguage: Language }) {
  const router = useRouter();

  useEffect(() => {
    let preferred = fallbackLanguage;
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && isSupportedLanguage(stored)) {
        preferred = stored;
      }
    } catch {
      // Ignore localStorage access errors and use fallback.
    }

    router.replace(`/${preferred}/dashboard`);
  }, [router, fallbackLanguage]);

  return null;
}
