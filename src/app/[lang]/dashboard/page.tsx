import { notFound } from "next/navigation";
import { SUPPORTED_LANGUAGES, type Language } from "../../../lib/i18n/locales.js";
import { getDictionary } from "../../../lib/i18n/getDictionary.js";
import { getDashboardData, getBalanceDriftData, MAX_DASHBOARD_MONTH_OFFSET } from "../../../lib/services/dashboardService.js";
import { getSettings } from "../../../lib/services/settingsService.js";
import { getAccountTypeOptions, getLoanCategoryOptions } from "../../../lib/settings/typeOptions.js";
import { formatMoney, formatMonthYear } from "../../../lib/format.js";
import { computeSolvencyRisk } from "../../../engine/metrics/index.js";
import { Badge } from "../../../components/ui/Badge.js";
import { LiquidityChart } from "../../../components/charts/LiquidityChart.js";
import { BalanceDriftChart } from "../../../components/charts/BalanceDriftChart.js";
import { EffortGauge } from "../../../components/charts/EffortGauge.js";
import { DashboardSuggestionWizards } from "../../../components/dashboard/DashboardSuggestionWizards.js";
import { LiveRefresh } from "../../../components/ui/LiveRefresh.js";
import { MonthKeyboardNav } from "../../../components/ui/MonthKeyboardNav.js";
import { OriginalDashboard } from "../../../components/original/OriginalDashboard.js";
import { getTheme } from "../../../lib/themeServer.js";
import {
  createDashboardAccountAction,
  createDashboardLoanAction,
  createDashboardScenarioAction,
  extractDashboardLoanFromContractAction,
} from "./actions.js";

function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function effortRateTone(percent: string | number): "healthy" | "warning" | "danger" {
  const value = Number(percent);
  if (value > 45) return "danger";
  if (value >= 30) return "warning";
  return "healthy";
}

function StepLink({ href, disabled, label, glyph }: { href: string; disabled: boolean; label: string; glyph: string }) {
  return (
    <a
      href={href}
      aria-disabled={disabled}
      title={label}
      aria-label={label}
      className={`h-7 min-w-7 px-1.5 inline-flex items-center justify-center border font-mono text-[13px] rounded-sm ${
        disabled
          ? "border-outline-variant text-outline-variant pointer-events-none"
          : "border-outline-variant text-on-surface-variant hover:border-on-surface hover:text-on-surface"
      }`}
    >
      {glyph}
    </a>
  );
}

function Figure({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="py-4 pr-3 even:pl-4 md:px-5 md:first:pl-0 min-w-0">
      <h4 className="eyebrow">{label}</h4>
      <p
        className={`figure mt-2 text-[18px] sm:text-[22px] xl:text-[26px] leading-tight truncate ${emphasis ? "text-primary" : "text-on-surface"}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function RiskReading({
  title,
  percent,
  tone,
  toneLabel,
  message,
}: {
  title: string;
  percent: number;
  tone: "healthy" | "warning" | "danger";
  toneLabel: string;
  message: string;
}) {
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-headline-sm text-on-surface">{title}</h3>
        <Badge tone={tone}>{toneLabel}</Badge>
      </div>
      <EffortGauge percent={percent} tone={tone} />
      <div className="relative h-4 font-mono text-[10.5px] text-outline mt-1">
        <span className="absolute left-0">0</span>
        <span className="absolute left-[30%] -translate-x-1/2">30</span>
        <span className="absolute left-[45%] -translate-x-1/2">45</span>
        <span className="absolute right-0">100</span>
      </div>
      <p className="text-body-sm text-on-surface-variant mt-3">{message}</p>
    </div>
  );
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ monthOffset?: string }>;
}) {
  if ((await getTheme()) === "original") {
    return <OriginalDashboard params={params} searchParams={searchParams} />;
  }
  const { lang } = await params;
  if (!isSupportedLanguage(lang)) notFound();
  const dict = getDictionary(lang);
  const query = await searchParams;
  const requestedMonthOffset = Number(query.monthOffset ?? "0");
  const monthOffset = Number.isFinite(requestedMonthOffset)
    ? Math.min(Math.max(Math.trunc(requestedMonthOffset), -MAX_DASHBOARD_MONTH_OFFSET), MAX_DASHBOARD_MONTH_OFFSET)
    : 0;
  const [data, settings, balanceDrift] = await Promise.all([
    getDashboardData(monthOffset),
    getSettings(),
    getBalanceDriftData(),
  ]);
  const effectiveMonthOffset = data.monthOffset;
  const balanceDriftAccountName = data.accounts.find((a) => a.id === balanceDrift.accountId)?.name;
  const accountTypeOptions = getAccountTypeOptions(settings);
  const loanCategoryOptions = getLoanCategoryOptions(settings);
  const createAccountFromDashboard = createDashboardAccountAction.bind(null, lang);
  const createLoanFromDashboard = createDashboardLoanAction.bind(null, lang);
  const createScenarioFromDashboard = createDashboardScenarioAction.bind(null, lang);
  const extractLoanFromContract = extractDashboardLoanFromContractAction.bind(null, lang);
  const tone = effortRateTone(data.effortRatePercent);
  const roundedPercent = Math.round(Number(data.effortRatePercent));

  const effortMessage =
    tone === "healthy"
      ? dict.dashboard.effortHealthy
      : tone === "warning"
        ? dict.dashboard.effortWarning.replace("{percent}", String(roundedPercent))
        : dict.dashboard.effortCritical.replace("{percent}", String(roundedPercent));

  const balanceNumber = Number(data.totalLiquidity.toDecimalString());
  const debtNumber = Number(data.debtOutstanding.toDecimalString());
  const solvencyRiskPercent = Math.round(computeSolvencyRisk(balanceNumber, debtNumber));
  const solvencyTone = effortRateTone(solvencyRiskPercent);

  const solvencyMessage =
    solvencyTone === "healthy"
      ? dict.dashboard.solvencyHealthy
      : solvencyTone === "warning"
        ? dict.dashboard.solvencyWarning.replace("{percent}", String(solvencyRiskPercent))
        : dict.dashboard.solvencyCritical.replace("{percent}", String(solvencyRiskPercent));

  const hasActionItems = data.liquidityBreachMonths.length > 0 || data.loanWarnings.length > 0;

  const monthOffsetHref = (offset: number) =>
    `?monthOffset=${Math.min(Math.max(offset, data.minMonthOffset), MAX_DASHBOARD_MONTH_OFFSET)}`;
  const chartRangeLabel = `${formatMonthYear(data.windowStartDate, lang)} – ${formatMonthYear(data.windowEndDate, lang)}`;

  const atStart = effectiveMonthOffset === data.minMonthOffset;
  const atEnd = effectiveMonthOffset === MAX_DASHBOARD_MONTH_OFFSET;

  return (
    <div className="flex flex-col gap-10">
      <LiveRefresh scope="accounts" />
      <MonthKeyboardNav
        previousHref={monthOffsetHref(effectiveMonthOffset - 1)}
        nextHref={monthOffsetHref(effectiveMonthOffset + 1)}
        atStart={atStart}
        atEnd={atEnd}
      />

      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between page-head border-b border-on-surface pb-5">
        <div>
          <h2 className="text-display-lg-mobile lg:text-display-lg text-on-background">{dict.dashboard.title}</h2>
          <p className="text-body-lg text-on-surface-variant mt-1 max-w-xl">{dict.dashboard.subtitle}</p>
        </div>
        <p className="font-mono text-label-sm text-on-surface-variant">{chartRangeLabel}</p>
      </header>

      {/* Key figures, one ruled band */}
      <section className="grid grid-cols-2 md:grid-cols-4 border-b border-outline-variant md:divide-x divide-outline-variant -mt-4 max-md:[&>*:nth-child(odd)]:border-r max-md:[&>*:nth-child(odd)]:border-outline-variant">
        <Figure label={dict.dashboard.netMonthlyIncome} value={formatMoney(data.netMonthlyIncome, lang)} />
        <Figure label={dict.dashboard.totalDebtService} value={formatMoney(data.monthlyDebtObligations, lang)} />
        <Figure label={dict.dashboard.debtOutstanding} value={formatMoney(data.debtOutstanding, lang)} />
        <Figure label={dict.dashboard.liquidReserve} value={formatMoney(data.totalLiquidity, lang)} emphasis />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-10">
        {/* Liquidity projection */}
        <section className="lg:col-span-8 min-w-0">
          <div className="flex items-end justify-between flex-wrap gap-3 border-b border-on-surface pb-2 mb-5">
            <h3 className="text-headline-sm text-on-surface">{dict.dashboard.projectedMinimumLiquidity.replace(" (12mo)", "")}</h3>
            <div className="flex items-center gap-1">
              <StepLink href={monthOffsetHref(effectiveMonthOffset - 12)} disabled={atStart} label={dict.simulation.previousYear} glyph="«" />
              <StepLink href={monthOffsetHref(effectiveMonthOffset - 1)} disabled={atStart} label={dict.simulation.previousMonth} glyph="‹" />
              <StepLink href={monthOffsetHref(effectiveMonthOffset + 1)} disabled={atEnd} label={dict.simulation.nextMonth} glyph="›" />
              <StepLink href={monthOffsetHref(effectiveMonthOffset + 12)} disabled={atEnd} label={dict.simulation.nextYear} glyph="»" />
            </div>
          </div>
          <div className="min-h-[240px]">
            {data.projection.length > 0 ? (
              <LiquidityChart
                data={data.projection}
                actual={data.actual}
                actualLabel={dict.dashboard.balanceDriftActual}
                projectedLabel={dict.dashboard.balanceDriftProjected}
                trend={data.savingsTrend}
                trendLabel={
                  data.averageMonthlySavings
                    ? dict.dashboard.savingsTrend.replace("{amount}", formatMoney(data.averageMonthlySavings, lang))
                    : undefined
                }
                lang={lang}
              />
            ) : (
              <p className="text-body-md text-on-surface-variant">{dict.simulation.empty}</p>
            )}
          </div>
        </section>

        {/* Risk readings */}
        <aside className="lg:col-span-4 lg:border-l lg:border-outline-variant lg:pl-8 divide-y divide-outline-variant">
          <RiskReading
            title={dict.dashboard.effortRate}
            percent={Number(data.effortRatePercent)}
            tone={tone}
            toneLabel={dict.common[tone === "danger" ? "critical" : tone]}
            message={effortMessage}
          />
          <RiskReading
            title={dict.dashboard.solvencyRisk}
            percent={solvencyRiskPercent}
            tone={solvencyTone}
            toneLabel={dict.common[solvencyTone === "danger" ? "critical" : solvencyTone]}
            message={solvencyMessage}
          />
        </aside>
      </div>

      {balanceDrift.accountId && (balanceDrift.projected.length > 0 || balanceDrift.actual.length > 0) && (
        <section className="min-w-0">
          <div className="border-b border-on-surface pb-2 mb-2">
            <h3 className="text-headline-sm text-on-surface">{dict.dashboard.balanceDriftTitle}</h3>
          </div>
          <p className="text-body-sm text-on-surface-variant mb-5 max-w-3xl">
            {dict.dashboard.balanceDriftSubtitle.replace("{account}", balanceDriftAccountName ?? "")}
          </p>
          <div className="w-full min-w-0">
            <BalanceDriftChart
              projected={balanceDrift.projected}
              actual={balanceDrift.actual}
              projectedLabel={dict.dashboard.balanceDriftProjected}
              actualLabel={dict.dashboard.balanceDriftActual}
              lang={lang}
            />
          </div>
        </section>
      )}

      {/* Action required */}
      <section>
        <div className="flex items-baseline justify-between border-b border-on-surface pb-2">
          <h3 className="text-headline-sm text-on-surface">{dict.dashboard.actionRequired}</h3>
          <span className="font-mono text-label-sm text-on-surface-variant">
            {data.liquidityBreachMonths.length + data.loanWarnings.length}
          </span>
        </div>
        {!hasActionItems ? (
          <p className="text-body-md text-on-surface-variant py-4">{dict.dashboard.noActionItems}</p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {data.liquidityBreachMonths.map((month) => (
              <li key={month} className="grid grid-cols-[12px_1fr] md:grid-cols-[12px_220px_1fr] gap-x-4 gap-y-1 py-3 items-baseline">
                <span aria-hidden className="w-2 h-2 bg-status-danger translate-y-[-1px]" />
                <span className="text-label-md text-on-surface font-medium">{dict.dashboard.reserveBreach}</span>
                <p className="col-start-2 md:col-start-auto text-body-md text-on-surface-variant">
                  {dict.dashboard.breachWarning.replace("{month}", String(month))}
                </p>
              </li>
            ))}
            {data.loanWarnings.map((warning) => (
              <li key={warning.loanId} className="grid grid-cols-[12px_1fr] md:grid-cols-[12px_220px_1fr] gap-x-4 gap-y-1 py-3 items-baseline">
                <span aria-hidden className="w-2 h-2 bg-status-warning translate-y-[-1px]" />
                <span className="text-label-md text-on-surface font-medium">{warning.loanName}</span>
                <p className="col-start-2 md:col-start-auto text-body-md text-on-surface-variant">{warning.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DashboardSuggestionWizards
        actions={{
          createAccount: createAccountFromDashboard,
          createLoan: createLoanFromDashboard,
          createScenario: createScenarioFromDashboard,
          extractLoanFromContract,
        }}
        accountTypeOptions={accountTypeOptions}
        loanCategoryOptions={loanCategoryOptions}
        accounts={data.accounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency }))}
        defaultCurrency={data.currency}
        labels={dict.wizards}
      />
    </div>
  );
}
