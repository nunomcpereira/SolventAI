import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SUPPORTED_LANGUAGES, type Language } from "../../lib/i18n/locales.js";
import { getDictionary } from "../../lib/i18n/getDictionary.js";
import { AppShell } from "../../components/shell/AppShell.js";
import { OriginalAppShell } from "../../components/original/OriginalAppShell.js";
import { LanguagePreferenceSync } from "../../components/i18n/LanguagePreferenceSync.js";
import { getTheme } from "../../lib/themeServer.js";

export function generateStaticParams() {
  return SUPPORTED_LANGUAGES.map((lang) => ({ lang }));
}

function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLanguage(lang)) {
    notFound();
  }
  const dict = getDictionary(lang);
  const theme = await getTheme();
  const Shell = theme === "original" ? OriginalAppShell : AppShell;

  return (
    <Shell lang={lang} dict={dict} theme={theme}>
      <LanguagePreferenceSync lang={lang} />
      {children}
    </Shell>
  );
}
