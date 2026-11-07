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

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ monthOffset?: string }>;
}) {
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

  return (
    <div className="flex flex-col gap-stack-lg">
      <LiveRefresh scope="accounts" />
      <MonthKeyboardNav
        previousHref={monthOffsetHref(effectiveMonthOffset - 1)}
        nextHref={monthOffsetHref(effectiveMonthOffset + 1)}
        atStart={effectiveMonthOffset === data.minMonthOffset}
        atEnd={effectiveMonthOffset === MAX_DASHBOARD_MONTH_OFFSET}
      />
      <div className="mb-2">
        <h2 className="text-display-lg-mobile lg:text-display-lg text-on-background">{dict.dashboard.title}</h2>
        <p className="text-body-lg text-on-surface-variant mt-2">{dict.dashboard.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-start gap-gutter">
        {/* Risk Gauges: Effort Rate & Solvency Risk */}
        <div className="lg:col-span-4 flex flex-col gap-gutter">
          {/* Effort Rate Gauge */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col">
            <h3 className="text-headline-sm text-on-surface mb-4">{dict.dashboard.effortRate}</h3>
            <div className="flex flex-col items-center gap-3 flex-1 justify-center">
              <EffortGauge percent={Number(data.effortRatePercent)} tone={tone} sizePx={150} />
              <Badge tone={tone}>{dict.common[tone === "danger" ? "critical" : tone]}</Badge>
              <p className="text-body-md text-on-surface-variant text-center">{effortMessage}</p>
            </div>
          </div>

          {/* Solvency Risk Gauge */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col">
            <h3 className="text-headline-sm text-on-surface mb-4">{dict.dashboard.solvencyRisk}</h3>
            <div className="flex flex-col items-center gap-3 flex-1 justify-center">
              <EffortGauge percent={solvencyRiskPercent} tone={solvencyTone} sizePx={150} />
              <Badge tone={solvencyTone}>{dict.common[solvencyTone === "danger" ? "critical" : solvencyTone]}</Badge>
              <p className="text-body-md text-on-surface-variant text-center">{solvencyMessage}</p>
            </div>
          </div>
        </div>

        {/* Liquidity chart + summary cards */}
        <div className="lg:col-span-8 flex flex-col gap-gutter">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
              <h3 className="text-headline-sm text-on-surface">{dict.dashboard.projectedMinimumLiquidity.replace(" (12mo)", "")}</h3>
              <div className="flex items-center gap-1">
                <a
                  href={monthOffsetHref(effectiveMonthOffset - 12)}
                  aria-disabled={effectiveMonthOffset === data.minMonthOffset}
                  className={`w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center transition-colors ${
                    effectiveMonthOffset === data.minMonthOffset
                      ? "text-on-surface-variant opacity-40 pointer-events-none"
                      : "text-on-surface-variant hover:text-primary hover:border-primary"
                  }`}
                  title={dict.simulation.previousYear}
                  aria-label={dict.simulation.previousYear}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    keyboard_double_arrow_left
                  </span>
                </a>
                <a
                  href={monthOffsetHref(effectiveMonthOffset - 1)}
                  aria-disabled={effectiveMonthOffset === data.minMonthOffset}
                  className={`w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center transition-colors ${
                    effectiveMonthOffset === data.minMonthOffset
                      ? "text-on-surface-variant opacity-40 pointer-events-none"
                      : "text-on-surface-variant hover:text-primary hover:border-primary"
                  }`}
                  title={dict.simulation.previousMonth}
                  aria-label={dict.simulation.previousMonth}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    chevron_left
                  </span>
                </a>
                <span className="text-label-md text-on-surface bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1 min-w-[160px] text-center">
                  {chartRangeLabel}
                </span>
                <a
                  href={monthOffsetHref(effectiveMonthOffset + 1)}
                  aria-disabled={effectiveMonthOffset === MAX_DASHBOARD_MONTH_OFFSET}
                  className={`w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center transition-colors ${
                    effectiveMonthOffset === MAX_DASHBOARD_MONTH_OFFSET
                      ? "text-on-surface-variant opacity-40 pointer-events-none"
                      : "text-on-surface-variant hover:text-primary hover:border-primary"
                  }`}
                  title={dict.simulation.nextMonth}
                  aria-label={dict.simulation.nextMonth}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    chevron_right
                  </span>
                </a>
                <a
                  href={monthOffsetHref(effectiveMonthOffset + 12)}
                  aria-disabled={effectiveMonthOffset === MAX_DASHBOARD_MONTH_OFFSET}
                  className={`w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center transition-colors ${
                    effectiveMonthOffset === MAX_DASHBOARD_MONTH_OFFSET
                      ? "text-on-surface-variant opacity-40 pointer-events-none"
                      : "text-on-surface-variant hover:text-primary hover:border-primary"
                  }`}
                  title={dict.simulation.nextYear}
                  aria-label={dict.simulation.nextYear}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    keyboard_double_arrow_right
                  </span>
                </a>
              </div>
            </div>
            <div className="flex-1 min-h-[220px]">
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
          </div>

          {/* Summary Cards Row (2 above, 2 below) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 xl:p-6 flex flex-col justify-between min-h-[120px]">
              <h4 className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">
                {dict.dashboard.netMonthlyIncome}
              </h4>
              <p className="text-headline-md font-bold text-on-surface tracking-tight" title={formatMoney(data.netMonthlyIncome, lang)}>
                {formatMoney(data.netMonthlyIncome, lang)}
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 xl:p-6 flex flex-col justify-between min-h-[120px]">
              <h4 className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">
                {dict.dashboard.totalDebtService}
              </h4>
              <p className="text-headline-md font-bold text-on-surface tracking-tight" title={formatMoney(data.monthlyDebtObligations, lang)}>
                {formatMoney(data.monthlyDebtObligations, lang)}
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 xl:p-6 flex flex-col justify-between min-h-[120px]">
              <h4 className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">
                {dict.dashboard.debtOutstanding}
              </h4>
              <p className="text-headline-md font-bold text-on-surface tracking-tight" title={formatMoney(data.debtOutstanding, lang)}>
                {formatMoney(data.debtOutstanding, lang)}
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 xl:p-6 flex flex-col justify-between min-h-[120px]">
              <h4 className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">
                {dict.dashboard.liquidReserve}
              </h4>
              <p className="text-headline-md font-bold text-on-surface tracking-tight" title={formatMoney(data.totalLiquidity, lang)}>
                {formatMoney(data.totalLiquidity, lang)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {balanceDrift.accountId && (balanceDrift.projected.length > 0 || balanceDrift.actual.length > 0) && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 overflow-hidden">
          <h3 className="text-headline-sm text-on-surface mb-1">{dict.dashboard.balanceDriftTitle}</h3>
          <p className="text-body-md text-on-surface-variant mb-6">
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
        </div>
      )}

      {/* Action Required */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            campaign
          </span>
          <h3 className="text-headline-sm text-on-surface">{dict.dashboard.actionRequired}</h3>
        </div>
        {!hasActionItems ? (
          <p className="text-body-md text-on-surface-variant">{dict.dashboard.noActionItems}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-md">
            {data.liquidityBreachMonths.map((month) => (
              <div key={month} className="p-4 bg-surface-container-low border border-outline-variant rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-status-danger" style={{ fontSize: "18px" }}>
                    warning
                  </span>
                  <span className="text-label-md text-on-surface font-semibold">{dict.dashboard.reserveBreach}</span>
                </div>
                <p className="text-body-md text-on-surface-variant">{dict.dashboard.breachWarning.replace("{month}", String(month))}</p>
              </div>
            ))}
            {data.loanWarnings.map((warning) => (
              <div key={warning.loanId} className="p-4 bg-surface-container-low border border-outline-variant rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-status-warning" style={{ fontSize: "18px" }}>
                    info
                  </span>
                  <span className="text-label-md text-on-surface font-semibold">{warning.loanName}</span>
                </div>
                <p className="text-body-md text-on-surface-variant">{warning.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

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
