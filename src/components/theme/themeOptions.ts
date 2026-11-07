import type { Dictionary } from "../../lib/i18n/getDictionary.js";
import type { Theme } from "../../lib/theme.js";

/** Theme selector entries, in display order. One list for the sidebar, Settings and the original shell. */
export function themeOptions(common: Dictionary["common"]): { value: Theme; label: string }[] {
  return [
    { value: "classic", label: common.themeClassic },
    { value: "classic-dark", label: common.themeClassicDark },
    { value: "ledger", label: common.themeLedger },
    { value: "ledger-dark", label: common.themeLedgerDark },
    { value: "original", label: common.themeOriginal },
  ];
}
