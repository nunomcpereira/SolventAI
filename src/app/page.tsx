import { getSettings } from "../lib/services/settingsService.js";
import { RootLanguageRedirect } from "../components/i18n/RootLanguageRedirect.js";

/** Defaults to English (DEFAULT_SETTINGS.language) until the user changes it in Settings. */
export default async function RootPage() {
  const settings = await getSettings();
  return <RootLanguageRedirect fallbackLanguage={settings.language} />;
}
