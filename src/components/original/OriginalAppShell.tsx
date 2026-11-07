/**
 * Pre-redesign UI (master @ 4f98e24), kept verbatim for the "original" theme.
 * Only imports/exports were adapted. Do not restyle; use the main components instead.
 */
import type { ReactNode } from "react";
import { type Language } from "../../lib/i18n/locales.js";
import { type Dictionary } from "../../lib/i18n/getDictionary.js";
import { buildNavItems } from "../shell/navItems.js";
import { OriginalSidebarNav as SidebarNav, OriginalBottomNav as BottomNav } from "./OriginalSidebarNav.js";
import { TenantSwitcher } from "../shell/TenantSwitcher.js";
import { themeOptions } from "../theme/themeOptions.js";
import { ThemeSelect } from "../theme/ThemeSelect.js";
import { type Theme } from "../../lib/theme.js";
import { listTenants, getCurrentTenantId } from "../../lib/services/tenantService.js";

/**
 * The Stitch mockups' shell, ported 1:1 per breakpoint:
 *  - Desktop (md+): fixed left sidebar (desktop_* mockups) — logo, "New Analysis" CTA (opens the scenario planner),
 *    4 primary nav items (Dashboard / Portfolio / Scenario / Settings), account footer.
 *  - Mobile (<md): top app bar + bottom nav bar (the "_updated" mobile mockups).
 * "Portfolio" covers both Loans and Accounts (the mockups only ever show 4 sidebar
 * items) — the Loans and Accounts pages cross-link to each other via an in-page tab.
 */
export async function OriginalAppShell({
  lang,
  dict,
  theme,
  children,
}: {
  lang: Language;
  dict: Dictionary;
  theme: Theme;
  children: ReactNode;
}) {
  const items = buildNavItems(lang, dict);
  const [tenants, currentTenantId] = await Promise.all([listTenants(), getCurrentTenantId()]);

  return (
    <div className="flex min-h-screen text-on-surface bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 h-full flex flex-col py-stack-lg bg-surface-container-low border-r border-outline-variant w-64 z-40 hidden lg:flex">
        <div className="px-gutter mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                account_balance
              </span>
            </div>
            <div>
              <h1 className="text-headline-sm font-bold text-primary">Solvent AI</h1>
              <p className="text-label-sm text-on-surface-variant">Enterprise Finance</p>
            </div>
          </div>
        </div>
        <div className="px-gutter mb-6">
          <a
            href={`/${lang}/simulation?new=1`}
            className="block w-full text-center bg-primary text-on-primary text-label-md py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            {dict.nav.newAnalysis}
          </a>
        </div>
        <SidebarNav items={items} />
        <div className="px-gutter mt-auto">
          <ThemeSelect
            variant="form"
            initialTheme={theme}
            label={dict.common.theme}
            options={themeOptions(dict.common)}
          />
        </div>
      </aside>

      {/* Mobile top app bar */}
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest border-b border-outline-variant lg:hidden flex justify-between items-center px-container-padding-mobile py-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
          <h1 className="text-headline-md font-bold text-primary tracking-tight">Solvent AI</h1>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-64 w-full max-w-[1280px] mx-auto pt-16 lg:pt-0 pb-24 lg:pb-0">
        {/* Desktop top bar */}
        <header className="hidden lg:flex w-full h-16 bg-surface-container-lowest border-b border-outline-variant justify-between items-center px-container-padding-desktop sticky top-0 z-30">
          <div className="flex items-center bg-surface-container-low rounded-full px-4 py-2 border border-outline-variant focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all w-64">
            <span className="material-symbols-outlined text-on-surface-variant mr-2" style={{ fontSize: "20px" }}>
              search
            </span>
            <input
              className="bg-transparent border-none outline-none text-body-md w-full placeholder:text-on-surface-variant text-on-surface"
              placeholder="Search..."
              type="text"
            />
          </div>
          <div className="flex items-center gap-4">
            <TenantSwitcher
              tenants={tenants}
              currentTenantId={currentTenantId}
              label={dict.common.tenantLabel}
              createDemoLabel={dict.common.createDemoAccount}
              variant="original"
            />
            <button
              type="button"
              className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors"
              aria-label="Notifications"
              title="Notifications"
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button
              type="button"
              className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors"
              aria-label="Help"
              title="Help"
            >
              <span className="material-symbols-outlined">help</span>
            </button>
            <div className="hidden xl:flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-label-md text-primary hover:bg-surface-container-low transition-colors"
              >
                Support
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-label-md bg-primary text-on-primary hover:opacity-90 transition-opacity"
              >
                Upgrade
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-container-padding-mobile md:p-container-padding-desktop">{children}</main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}
