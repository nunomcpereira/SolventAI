import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SUPPORTED_LANGUAGES, type Language } from "../../../lib/i18n/locales.js";
import { getDictionary } from "../../../lib/i18n/getDictionary.js";
import { getSettings } from "../../../lib/services/settingsService.js";
import { isLocalEndpoint } from "../../../lib/ai/extraction/llmClient.js";
import { CustomTypeListEditor } from "../../../components/settings/CustomTypeListEditor.js";
import { saveSettingsAction } from "./actions.js";
import { ThemeSelect } from "../../../components/theme/ThemeSelect.js";
import { getTheme } from "../../../lib/themeServer.js";

const REGISTERED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "KWD"] as const;
const APP_VERSION = "0.1.0";

function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export default async function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLanguage(lang)) notFound();
  const dict = getDictionary(lang);
  const [settings, theme] = await Promise.all([getSettings(), getTheme()]);
  const boundAction = saveSettingsAction.bind(null, lang);

  // Truthful, not decorative: only claim "100% offline" when it's actually the case
  // for the settings as saved right now (spec section 27 — privacy claims must be
  // verifiable, never a fake trust badge).
  const isFullyOffline = !settings.llmEnabled || (isLocalEndpoint(settings.llmEndpoint) && !settings.allowCloudLlmFallback);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="page-head border-b border-on-surface pb-5">
        <h1 className="text-display-lg-mobile md:text-display-lg text-on-background">{dict.settings.title}</h1>
        <p className="text-body-lg text-on-surface-variant mt-2">{dict.settings.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-x-10 gap-y-gutter items-start">
        {/* Section anchor nav (desktop only) */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-10 border-t border-on-surface pt-3">
            <ul className="flex flex-col">
              <li>
                <a className="block py-1.5 text-on-surface-variant hover:text-on-surface hover:underline underline-offset-4 decoration-1 text-label-md" href="#financial">
                  {dict.settings.financialEngine}
                </a>
              </li>
              <li>
                <a className="block py-1.5 text-on-surface-variant hover:text-on-surface hover:underline underline-offset-4 decoration-1 text-label-md" href="#security">
                  {dict.settings.security}
                </a>
              </li>
              <li>
                <a className="block py-1.5 text-on-surface-variant hover:text-on-surface hover:underline underline-offset-4 decoration-1 text-label-md" href="#appearance">
                  {dict.common.theme}
                </a>
              </li>
              <li>
                <a className="block py-1.5 text-on-surface-variant hover:text-on-surface hover:underline underline-offset-4 decoration-1 text-label-md" href="#privacy">
                  {dict.settings.privacyAndStatus}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Settings content */}
        <div className="lg:col-span-3 flex flex-col gap-10">
          <form action={boundAction} className="flex flex-col gap-stack-lg">
            <Section id="financial" icon="account_balance" title={dict.settings.financialEngine}>
              <FieldRow label={dict.settings.baseCurrency} help={dict.settings.baseCurrencyHelp}>
                <select
                  name="baseCurrency"
                  defaultValue={settings.baseCurrency}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  {REGISTERED_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </FieldRow>

              <FieldRow label={dict.settings.roundingPolicy}>
                <select
                  name="roundingMode"
                  defaultValue={settings.roundingMode}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="half-up">Half-up</option>
                  <option value="half-even">Half-even (banker&apos;s rounding)</option>
                  <option value="down">Down (truncate)</option>
                  <option value="up">Up</option>
                </select>
              </FieldRow>

              <FieldRow label={dict.settings.dayCountDefault}>
                <select
                  name="dayCountDefault"
                  defaultValue={settings.dayCountDefault}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="actual/360">Actual/360</option>
                  <option value="actual/365">Actual/365</option>
                  <option value="30/360">30/360</option>
                </select>
              </FieldRow>

              <FieldRow label={dict.settings.language}>
                <select
                  name="language"
                  defaultValue={settings.language}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l.toUpperCase()}
                    </option>
                  ))}
                </select>
              </FieldRow>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                <div className="flex flex-col gap-stack-sm">
                  <p className="text-label-sm text-on-surface-variant">Account type labels</p>
                  <FieldRow label="Checking label">
                    <input
                      name="accountTypeLabel_checking"
                      defaultValue={settings.accountTypeLabels.checking}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                  <FieldRow label="Savings label">
                    <input
                      name="accountTypeLabel_savings"
                      defaultValue={settings.accountTypeLabels.savings}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                  <FieldRow label="Emergency label">
                    <input
                      name="accountTypeLabel_emergency"
                      defaultValue={settings.accountTypeLabels.emergency}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                  <FieldRow label="Investment label">
                    <input
                      name="accountTypeLabel_investment"
                      defaultValue={settings.accountTypeLabels.investment}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                  <FieldRow label="Other account label">
                    <input
                      name="accountTypeLabel_other"
                      defaultValue={settings.accountTypeLabels.other}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                </div>

                <div className="flex flex-col gap-stack-sm">
                  <p className="text-label-sm text-on-surface-variant">Loan type labels</p>
                  <FieldRow label="Mortgage label">
                    <input
                      name="loanCategoryLabel_mortgage"
                      defaultValue={settings.loanCategoryLabels.mortgage}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                  <FieldRow label="Auto label">
                    <input
                      name="loanCategoryLabel_auto"
                      defaultValue={settings.loanCategoryLabels.auto}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                  <FieldRow label="Personal label">
                    <input
                      name="loanCategoryLabel_personal"
                      defaultValue={settings.loanCategoryLabels.personal}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                  <FieldRow label="Consumer label">
                    <input
                      name="loanCategoryLabel_consumer"
                      defaultValue={settings.loanCategoryLabels.consumer}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                  <FieldRow label="Student label">
                    <input
                      name="loanCategoryLabel_student"
                      defaultValue={settings.loanCategoryLabels.student}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                  <FieldRow label="Other loan label">
                    <input
                      name="loanCategoryLabel_other"
                      defaultValue={settings.loanCategoryLabels.other}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FieldRow>
                  <FieldRow label="Custom loan types" help="Add, edit, or remove custom loan types.">
                    <CustomTypeListEditor
                      name="customLoanCategories"
                      initialValues={settings.customLoanCategories}
                      addLabel="Add loan type"
                      emptyLabel="No custom loan types yet."
                      placeholder="e.g. Bridge loan"
                    />
                  </FieldRow>
                </div>

                <div className="flex flex-col gap-stack-sm">
                  <p className="text-label-sm text-on-surface-variant">Income types</p>
                  <FieldRow label="Custom income types" help="Add, edit, or remove custom income types.">
                    <CustomTypeListEditor
                      name="customIncomeCategories"
                      initialValues={settings.customIncomeCategories}
                      addLabel="Add income type"
                      emptyLabel="No custom income types yet."
                      placeholder="e.g. Rental income"
                    />
                  </FieldRow>
                </div>
              </div>
            </Section>

            <Section id="security" icon="security" title={dict.settings.security}>
              <FieldRow label={dict.settings.llmEndpoint} help={dict.settings.llmEndpointHelp}>
                <input
                  name="llmEndpoint"
                  defaultValue={settings.llmEndpoint}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </FieldRow>

              <ToggleRow name="llmEnabled" defaultChecked={settings.llmEnabled} label={dict.settings.llmEnabled} />

              <div className="flex flex-col gap-stack-sm">
                <ToggleRow
                  name="allowCloudLlmFallback"
                  defaultChecked={settings.allowCloudLlmFallback}
                  label={dict.settings.allowCloudLlmFallback}
                />
                <div className="flex items-start gap-2 bg-status-warning/10 border border-status-warning text-status-warning rounded-lg p-3">
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: "18px" }}>
                    warning
                  </span>
                  <p className="text-label-sm">{dict.settings.allowCloudLlmFallbackWarning}</p>
                </div>
              </div>
            </Section>

            <button
              type="submit"
              className="self-start bg-primary text-on-primary rounded-lg px-6 py-3 text-label-md font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              {dict.settings.save}
            </button>
          </form>

          <Section id="appearance" title={dict.common.theme}>
            <ThemeSelect
              variant="form"
              initialTheme={theme}
              label={dict.common.theme}
              options={[
                { value: "classic", label: dict.common.themeClassic },
                { value: "ledger", label: dict.common.themeLedger },
                { value: "original", label: dict.common.themeOriginal },
              ]}
              className="max-w-xs"
            />
          </Section>

          <Section id="privacy" icon="verified_user" title={dict.settings.privacyAndStatus}>
            <div
              className={`flex items-center gap-3 p-4 rounded-lg border ${
                isFullyOffline
                  ? "bg-status-healthy/10 border-status-healthy text-status-healthy"
                  : "bg-status-warning/10 border-status-warning text-status-warning"
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                {isFullyOffline ? "offline_pin" : "cloud"}
              </span>
              <div>
                <p className="text-body-md font-medium">
                  {isFullyOffline ? dict.settings.offlineModeActive : dict.settings.nonLocalEndpointWarning}
                </p>
                <p className="text-label-sm opacity-90">
                  {isFullyOffline ? dict.settings.offlineModeDescription : dict.settings.nonLocalEndpointDescription}
                </p>
              </div>
            </div>

            <p className="text-body-md text-on-surface-variant">{dict.settings.privacyNote}</p>

            <div className="flex items-center justify-between pt-stack-md border-t border-outline-variant text-label-sm text-on-surface-variant">
              <span>{dict.settings.appVersion}</span>
              <span>v{APP_VERSION}</span>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; icon?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-stack-md scroll-mt-20">
      <div className="border-b border-on-surface pb-2">
        <h2 className="text-headline-sm text-on-background">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FieldRow({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      {children}
      {help ? <span className="text-label-sm text-on-surface-variant">{help}</span> : null}
    </label>
  );
}

function ToggleRow({ name, defaultChecked, label }: { name: string; defaultChecked: boolean; label: string }) {
  return (
    <label className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-surface-container-low transition-colors">
      <span className="text-body-md text-on-surface">{label}</span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="sr-only peer" />
      <div className="w-11 h-6 bg-outline-variant peer-checked:bg-primary rounded-full relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
    </label>
  );
}
