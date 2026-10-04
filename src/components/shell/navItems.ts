import { type Language } from "../../lib/i18n/locales.js";
import { type Dictionary } from "../../lib/i18n/getDictionary.js";

export interface NavItem {
  href: string;
  icon: string;
  label: string;
  /** Path segments that should highlight this item as active (Portfolio covers both Loans and Accounts). */
  matchSegments: string[];
}

export function buildNavItems(lang: Language, dict: Dictionary): NavItem[] {
  return [
    { href: `/${lang}/dashboard`, icon: "dashboard", label: dict.nav.dashboard, matchSegments: ["dashboard"] },
    { href: `/${lang}/accounts`, icon: "account_balance", label: dict.nav.accounts, matchSegments: ["accounts"] },
    { href: `/${lang}/loans`, icon: "account_balance_wallet", label: dict.nav.loans, matchSegments: ["loans"] },
    { href: `/${lang}/simulation`, icon: "query_stats", label: dict.nav.simulation, matchSegments: ["simulation"] },
    { href: `/${lang}/settings`, icon: "settings", label: dict.nav.settings, matchSegments: ["settings"] },
  ];
}
