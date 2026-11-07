import type { ReactNode } from "react";
import { type Language } from "../../lib/i18n/locales.js";
import { type Dictionary } from "../../lib/i18n/getDictionary.js";
import { buildNavItems } from "./navItems.js";
import { SidebarNav, BottomNav } from "./SidebarNav.js";
import { TenantSwitcher } from "./TenantSwitcher.js";
import { listTenants, getCurrentTenantId } from "../../lib/services/tenantService.js";
import { ThemeSelect } from "../theme/ThemeSelect.js";
import { type Theme } from "../../lib/theme.js";

function Wordmark({ inSidebar = false }: { inSidebar?: boolean }) {
  return (
    <span
      className={`font-serif text-[22px] leading-none tracking-tight ${inSidebar ? "text-[var(--sidebar-strong)]" : "text-on-surface"}`}
    >
      Solvent<span className={inSidebar ? "text-[var(--sidebar-accent)]" : "text-primary"}>.</span>
    </span>
  );
}

/**
 * Desktop (lg+): left rail with the wordmark, numbered navigation, a quiet
 * "new scenario" link, and the account + theme switchers at the foot. Sidebar colours
 * come from the --sidebar-* variables so each theme can style the rail independently.
 * Mobile: slim paper header + bottom tab bar.
 */
export async function AppShell({
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
  const today = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <div className="flex min-h-screen text-on-surface bg-background">
      <aside className="fixed left-0 top-0 h-full w-60 z-40 hidden lg:flex flex-col bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] border-r border-[var(--sidebar-border)]">
        <div className="px-6 pt-7 pb-8">
          <a href={`/${lang}/dashboard`} className="block">
            <Wordmark inSidebar />
          </a>
          <p className="mt-2 text-[11.5px] text-[var(--sidebar-fg)] font-mono">{today}</p>
        </div>

        <SidebarNav items={items} />

        <div className="px-6 mt-6">
          <a
            href={`/${lang}/simulation?new=1`}
            className="group inline-flex items-center gap-2 text-[13px] text-[var(--sidebar-strong)] border-b border-[var(--sidebar-border)] hover:border-[var(--sidebar-accent)] pb-0.5"
          >
            <span className="font-mono text-[var(--sidebar-accent)]">+</span>
            {dict.nav.newAnalysis}
          </a>
        </div>

        <div className="mt-auto px-6 pb-6 pt-5 border-t border-[var(--sidebar-border)] flex flex-col gap-3">
          <TenantSwitcher
            tenants={tenants}
            currentTenantId={currentTenantId}
            label={dict.common.tenantLabel}
            createDemoLabel={dict.common.createDemoAccount}
          />
          <ThemeSelect
            initialTheme={theme}
            label={dict.common.theme}
            options={[
              { value: "classic", label: dict.common.themeClassic },
              { value: "ledger", label: dict.common.themeLedger },
            ]}
          />
        </div>
      </aside>

      <header className="fixed top-0 inset-x-0 z-50 h-14 bg-background/95 backdrop-blur border-b border-on-surface lg:hidden flex items-center justify-between px-container-padding-mobile">
        <a href={`/${lang}/dashboard`}>
          <Wordmark />
        </a>
        <span className="text-[11.5px] text-on-surface-variant font-mono">{today}</span>
      </header>

      <div className="flex-1 flex flex-col lg:ml-60 min-w-0 pt-14 lg:pt-0 pb-24 lg:pb-0">
        <main className="flex-1 w-full max-w-[1240px] px-container-padding-mobile md:px-container-padding-desktop py-6 md:py-10">
          {children}
        </main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}
