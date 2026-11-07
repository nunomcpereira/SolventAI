"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MonthKeyboardNav } from "../ui/MonthKeyboardNav.js";
import { ComparisonChart, type ChartEventMarker } from "../charts/ComparisonChart.js";
import { EffortGauge } from "../charts/EffortGauge.js";
import { Badge } from "../ui/Badge.js";
import { formatMoney, formatPercent } from "../../lib/format.js";
import { Money } from "../../engine/money/money.js";
import { type SimulationProjectionPoint } from "../../lib/services/simulationService.js";

function effortRateTone(percent: number): "healthy" | "warning" | "danger" {
  if (percent > 45) return "danger";
  if (percent >= 30) return "warning";
  return "healthy";
}

/**
 * Solvency risk: 100% once the balance is negative (or non-positive with no debt to
 * offset it), 0% once the balance covers the total outstanding debt, and ramping
 * linearly between those — so a positive balance trending down toward zero shows
 * rising risk period over period, without needing to look at multiple periods at
 * once (each period's risk is a pure function of that period's balance vs. debt).
 */
function computeSolvencyRisk(balance: number, debt: number): number {
  if (balance <= 0) return 100;
  if (debt <= 0 || balance >= debt) return 0;
  return Math.max(0, Math.min(100, 100 * (1 - balance / debt)));
}

interface AccountOption {
  id: string;
  name: string;
}

interface LabeledItemOption {
  id: string;
  label: string;
}

export interface ScenarioOption {
  /** Empty string represents the base scenario (no scenario selected). */
  id: string;
  name: string;
  href: string;
}

export interface ChartNavigation {
  label: string;
  previousYearHref: string;
  nextYearHref: string;
  previousMonthHref: string;
  nextMonthHref: string;
  atStart: boolean;
  atEnd: boolean;
  previousYearLabel: string;
  nextYearLabel: string;
  previousMonthLabel: string;
  nextMonthLabel: string;
}

function NavButton({ href, disabled, label, icon }: { href: string; disabled: boolean; label: string; icon: string }) {
  // Link (client-side transition) rather than a plain <a> — a full browser navigation
  // would remount this component and lose its maximize/hover state, kicking the user
  // back out of fullscreen every time they page through the timeline.
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      title={label}
      aria-label={label}
      className={`w-8 h-8 rounded-sm border border-outline-variant flex items-center justify-center transition-colors ${
        disabled ? "text-on-surface-variant opacity-40 pointer-events-none" : "text-on-surface-variant hover:text-primary hover:border-primary"
      }`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
        {icon}
      </span>
    </Link>
  );
}

/** A visually distinct divider row between the table's sections (summary, account
 * balances, income/expense/loan components) — a plain small-caps row wasn't enough to
 * separate them from the data rows above/below at a glance. */
function SectionHeaderRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="pt-3 pb-2 bg-surface-container-low">
        <span className="text-label-sm text-primary font-bold">{label}</span>
      </td>
    </tr>
  );
}

export function SimulationChartCard({
  base,
  scenario,
  baseLabel,
  scenarioLabel,
  incomeLabel,
  loanPaymentsLabel,
  expensesLabel,
  ratePercentLabel,
  effortRatePercentLabel,
  events,
  actual,
  actualLabel,
  eventEffectTitle,
  closeLabel,
  emptyLabel,
  effortRateTitle,
  toneLabels,
  accounts,
  incomeItems,
  expenseItems,
  loanItems,
  currency,
  lang,
  accountBalancesTitle,
  maximizeLabel,
  minimizeLabel,
  navigation,
  summaryTitle,
  currentDebtLabel,
  monthlyPaymentLabel,
  euriborLabel,
  incomeComponentsLabel,
  expenseComponentsLabel,
  loanComponentsLabel,
  outstandingLabel,
  negativeBalanceWarning,
  scenarioOptions,
  selectedScenarioId,
  scenarioSelectorLabel,
  solvencyRiskTitle,
}: {
  base: SimulationProjectionPoint[];
  scenario: SimulationProjectionPoint[];
  baseLabel: string;
  scenarioLabel: string;
  incomeLabel: string;
  loanPaymentsLabel: string;
  expensesLabel: string;
  ratePercentLabel: string;
  effortRatePercentLabel: string;
  events: ChartEventMarker[];
  actual?: { date: string; totalLiquidity: string }[];
  actualLabel?: string;
  /** Heading + close-button label for the event details popup — event markers only
   * become clickable once both are provided (see ComparisonChart). */
  eventEffectTitle?: string;
  closeLabel?: string;
  emptyLabel: string;
  effortRateTitle: string;
  toneLabels: { healthy: string; warning: string; critical: string };
  accounts: AccountOption[];
  incomeItems: LabeledItemOption[];
  expenseItems: LabeledItemOption[];
  loanItems: LabeledItemOption[];
  currency: string;
  lang: string;
  accountBalancesTitle: string;
  maximizeLabel: string;
  minimizeLabel: string;
  navigation: ChartNavigation;
  summaryTitle: string;
  currentDebtLabel: string;
  monthlyPaymentLabel: string;
  euriborLabel: string;
  incomeComponentsLabel: string;
  expenseComponentsLabel: string;
  loanComponentsLabel: string;
  outstandingLabel: string;
  negativeBalanceWarning: string;
  scenarioOptions: ScenarioOption[];
  selectedScenarioId: string;
  scenarioSelectorLabel: string;
  solvencyRiskTitle: string;
}) {
  const router = useRouter();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const active = scenario.length > 0 ? scenario : base;
  const shownIndex = hoveredIndex !== null ? hoveredIndex : 0;
  const shownPoint = active[shownIndex] ?? active[0];
  const shownBasePoint = base[shownIndex] ?? base[0];
  const shownScenarioPoint = scenario[shownIndex] ?? scenario[0];
  const effortRatePercent = shownPoint?.effortRatePercent;
  // Debt-to-income alone can look "fine" while an account is actually overdrawn (e.g.
  // income covers the loan payment comfortably, but a large one-time outflow already
  // pushed the balance negative) — total liquidity across accounts must also escalate
  // severity, not just the income/debt ratio.
  const totalBalance = shownPoint?.accountBalances.reduce((sum, b) => sum + Number(b.balance), 0) ?? 0;
  const hasNegativeBalance = totalBalance < 0;
  const tone =
    effortRatePercent !== undefined || hasNegativeBalance
      ? hasNegativeBalance
        ? "danger"
        : effortRateTone(Number(effortRatePercent))
      : undefined;
  const totalDebt = Number(shownPoint?.totalOutstandingDebt ?? "0");
  const solvencyRiskPercent = shownPoint !== undefined ? computeSolvencyRisk(totalBalance, totalDebt) : undefined;
  const solvencyTone = solvencyRiskPercent !== undefined ? effortRateTone(solvencyRiskPercent) : undefined;
  const hasDistinctScenario = scenario !== base;

  useEffect(() => {
    if (!isMaximized) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMaximized(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized]);

  if (base.length === 0) {
    return <p className="text-body-md text-on-surface-variant">{emptyLabel}</p>;
  }

  const money = (value: string | undefined) => (value !== undefined ? formatMoney(Money.fromDecimalString(value, currency), lang) : "—");
  const balanceFor = (point: SimulationProjectionPoint | undefined, accountId: string): string | undefined =>
    point?.accountBalances.find((b) => b.accountId === accountId)?.balance;
  const incomeComponentFor = (point: SimulationProjectionPoint | undefined, itemId: string): string | undefined =>
    point?.incomeComponents.find((c) => c.itemId === itemId)?.amount;
  const allIncomeItemIds = Array.from(
    new Set([...(shownBasePoint?.incomeComponents.map((c) => c.itemId) ?? []), ...(shownScenarioPoint?.incomeComponents.map((c) => c.itemId) ?? [])]),
  );
  const expenseComponentFor = (point: SimulationProjectionPoint | undefined, itemId: string): string | undefined =>
    point?.expenseComponents.find((c) => c.itemId === itemId)?.amount;
  const allExpenseItemIds = Array.from(
    new Set([...(shownBasePoint?.expenseComponents.map((c) => c.itemId) ?? []), ...(shownScenarioPoint?.expenseComponents.map((c) => c.itemId) ?? [])]),
  );
  const debtComponentFor = (point: SimulationProjectionPoint | undefined, loanId: string): { amount: string; outstanding: string } | undefined =>
    point?.debtComponents.find((c) => c.loanId === loanId);
  const allLoanIds = Array.from(
    new Set([...(shownBasePoint?.debtComponents.map((c) => c.loanId) ?? []), ...(shownScenarioPoint?.debtComponents.map((c) => c.loanId) ?? [])]),
  );

  return (
    <div
      className={
        isMaximized
          ? "fixed inset-4 z-50 bg-surface-container-lowest border border-outline-variant rounded-sm p-6 overflow-auto shadow-2xl flex flex-col gap-gutter"
          : "flex flex-col gap-gutter"
      }
    >
      <MonthKeyboardNav
        previousHref={navigation.previousMonthHref}
        nextHref={navigation.nextMonthHref}
        atStart={navigation.atStart}
        atEnd={navigation.atEnd}
      />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1">
          <NavButton href={navigation.previousYearHref} disabled={navigation.atStart} label={navigation.previousYearLabel} icon="keyboard_double_arrow_left" />
          <NavButton href={navigation.previousMonthHref} disabled={navigation.atStart} label={navigation.previousMonthLabel} icon="chevron_left" />
          <span className="text-label-md text-on-surface bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1 min-w-[160px] text-center">
            {navigation.label}
          </span>
          <NavButton href={navigation.nextMonthHref} disabled={navigation.atEnd} label={navigation.nextMonthLabel} icon="chevron_right" />
          <NavButton href={navigation.nextYearHref} disabled={navigation.atEnd} label={navigation.nextYearLabel} icon="keyboard_double_arrow_right" />
        </div>
        <div className="flex items-center gap-3">
          {/* Lets the user switch which scenario is being compared without leaving
              fullscreen — this select lives inside the card (unlike the full scenario
              management panel) specifically so it's still reachable while maximized. */}
          <label className="flex items-center gap-2 eyebrow">
            {scenarioSelectorLabel}
            <select
              value={selectedScenarioId}
              onChange={(event) => {
                const option = scenarioOptions.find((o) => o.id === event.target.value);
                if (option) router.push(option.href);
              }}
              className="border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm bg-surface-container-low focus:outline-none focus:border-primary max-w-[220px]"
            >
              {scenarioOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setIsMaximized((v) => !v)}
            aria-label={isMaximized ? minimizeLabel : maximizeLabel}
            title={isMaximized ? minimizeLabel : maximizeLabel}
            className="w-8 h-8 rounded-sm border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary hover:bg-surface-container-low transition-colors inline-flex items-center justify-center shrink-0"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              {isMaximized ? "close_fullscreen" : "open_in_full"}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-gutter items-stretch">
        <div className="flex-1 min-w-0">
          <ComparisonChart
            base={base}
            scenario={scenario}
            baseLabel={baseLabel}
            scenarioLabel={scenarioLabel}
            incomeLabel={incomeLabel}
            loanPaymentsLabel={loanPaymentsLabel}
            expensesLabel={expensesLabel}
            currentDebtLabel={currentDebtLabel}
            ratePercentLabel={ratePercentLabel}
            effortRatePercentLabel={effortRatePercentLabel}
            events={events}
            {...(actual ? { actual } : {})}
            {...(actualLabel ? { actualLabel } : {})}
            {...(eventEffectTitle ? { eventEffectTitle } : {})}
            {...(closeLabel ? { closeLabel } : {})}
            onHoverIndex={setHoveredIndex}
            lang={lang}
            {...(isMaximized ? { height: 480 } : {})}
          />
        </div>
        {/* Fixed width/height regardless of whether a rate is available for the shown
            period — the gauges/badges/date must never unmount on hover, since that
            resizes this flex row and shifts the chart under the pointer, which flickers
            the reading in a feedback loop (verified: hiding this panel widens the chart,
            moving the hovered index). */}
        <div className="shrink-0 flex flex-col items-center text-center gap-2 lg:border-l lg:border-outline-variant lg:pl-gutter lg:w-[190px]">
          <div className="flex flex-col items-center text-center gap-2">
            <h4 className="text-label-md text-on-surface font-semibold">{effortRateTitle}</h4>
            {tone !== undefined ? (
              <>
                <EffortGauge percent={Number(effortRatePercent ?? "100")} tone={tone} sizePx={100} />
                <Badge tone={tone}>{toneLabels[tone === "danger" ? "critical" : tone]}</Badge>
                {hasNegativeBalance ? <span className="text-label-sm text-status-danger font-medium">{negativeBalanceWarning}</span> : null}
              </>
            ) : (
              <div className="w-full h-[68px] rounded-sm border border-dashed border-outline-variant flex items-center justify-center eyebrow">
                —
              </div>
            )}
          </div>
          <div className="flex flex-col items-center text-center gap-2 border-t border-outline-variant pt-3 mt-1">
            <h4 className="text-label-md text-on-surface font-semibold">{solvencyRiskTitle}</h4>
            {solvencyTone !== undefined && solvencyRiskPercent !== undefined ? (
              <>
                <EffortGauge percent={solvencyRiskPercent} tone={solvencyTone} sizePx={100} />
                <Badge tone={solvencyTone}>{toneLabels[solvencyTone === "danger" ? "critical" : solvencyTone]}</Badge>
              </>
            ) : (
              <div className="w-full h-[68px] rounded-sm border border-dashed border-outline-variant flex items-center justify-center eyebrow">
                —
              </div>
            )}
          </div>
          <span className="eyebrow">{`${shownPoint?.date ?? ""}`}</span>
        </div>
      </div>

      <div className="border-t border-outline-variant pt-gutter overflow-x-auto">
        <table className="w-full text-left text-body-md border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="py-2 pr-4 font-normal"></th>
              <th className="py-2 pr-4 text-label-sm text-on-surface-variant font-medium">{baseLabel}</th>
              {hasDistinctScenario ? <th className="py-2 pr-4 text-label-sm text-on-surface-variant font-medium">{scenarioLabel}</th> : null}
            </tr>
          </thead>
          <tbody>
            <SectionHeaderRow label={summaryTitle} colSpan={hasDistinctScenario ? 3 : 2} />
            <tr className="border-b border-outline-variant">
              <td className="py-2 pr-4 text-on-surface">{euriborLabel}</td>
              <td className="py-2 pr-4 text-on-surface">
                {shownBasePoint?.debtServiceRatePercent !== undefined ? formatPercent(shownBasePoint.debtServiceRatePercent.toString(), lang, 3) : "—"}
              </td>
              {hasDistinctScenario ? (
                <td className="py-2 pr-4 text-on-surface">
                  {shownScenarioPoint?.debtServiceRatePercent !== undefined
                    ? formatPercent(shownScenarioPoint.debtServiceRatePercent.toString(), lang, 3)
                    : "—"}
                </td>
              ) : null}
            </tr>
            <tr className="border-b border-outline-variant">
              <td className="py-2 pr-4 text-on-surface">{currentDebtLabel}</td>
              <td className="py-2 pr-4 text-on-surface">{money(shownBasePoint?.totalOutstandingDebt)}</td>
              {hasDistinctScenario ? <td className="py-2 pr-4 text-on-surface">{money(shownScenarioPoint?.totalOutstandingDebt)}</td> : null}
            </tr>
            <tr className="border-b border-outline-variant">
              <td className="py-2 pr-4 text-on-surface">{monthlyPaymentLabel}</td>
              <td className="py-2 pr-4 text-on-surface">{money(shownBasePoint?.totalDebtService)}</td>
              {hasDistinctScenario ? <td className="py-2 pr-4 text-on-surface">{money(shownScenarioPoint?.totalDebtService)}</td> : null}
            </tr>

            <SectionHeaderRow label={accountBalancesTitle} colSpan={hasDistinctScenario ? 3 : 2} />
            {accounts.map((account) => (
              <tr key={account.id} className="border-b border-outline-variant">
                <td className="py-2 pr-4 text-on-surface">{account.name}</td>
                <td className="py-2 pr-4 text-on-surface">{money(balanceFor(shownBasePoint, account.id))}</td>
                {hasDistinctScenario ? <td className="py-2 pr-4 text-on-surface">{money(balanceFor(shownScenarioPoint, account.id))}</td> : null}
              </tr>
            ))}

            {allIncomeItemIds.length > 0 ? <SectionHeaderRow label={incomeComponentsLabel} colSpan={hasDistinctScenario ? 3 : 2} /> : null}
            {allIncomeItemIds.map((itemId) => (
              <tr key={itemId} className="border-b border-outline-variant last:border-0">
                <td className="py-2 pr-4 text-on-surface">{incomeItems.find((i) => i.id === itemId)?.label ?? itemId}</td>
                <td className="py-2 pr-4 text-on-surface">{money(incomeComponentFor(shownBasePoint, itemId))}</td>
                {hasDistinctScenario ? <td className="py-2 pr-4 text-on-surface">{money(incomeComponentFor(shownScenarioPoint, itemId))}</td> : null}
              </tr>
            ))}

            {allExpenseItemIds.length > 0 ? <SectionHeaderRow label={expenseComponentsLabel} colSpan={hasDistinctScenario ? 3 : 2} /> : null}
            {allExpenseItemIds.map((itemId) => (
              <tr key={itemId} className="border-b border-outline-variant last:border-0">
                <td className="py-2 pr-4 text-on-surface">{expenseItems.find((i) => i.id === itemId)?.label ?? itemId}</td>
                <td className="py-2 pr-4 text-on-surface">{money(expenseComponentFor(shownBasePoint, itemId))}</td>
                {hasDistinctScenario ? <td className="py-2 pr-4 text-on-surface">{money(expenseComponentFor(shownScenarioPoint, itemId))}</td> : null}
              </tr>
            ))}

            {allLoanIds.length > 0 ? <SectionHeaderRow label={loanComponentsLabel} colSpan={hasDistinctScenario ? 3 : 2} /> : null}
            {allLoanIds.map((loanId) => {
              const baseComponent = debtComponentFor(shownBasePoint, loanId);
              const scenarioComponent = debtComponentFor(shownScenarioPoint, loanId);
              return (
                <tr key={loanId} className="border-b border-outline-variant last:border-0">
                  <td className="py-2 pr-4 text-on-surface">{loanItems.find((l) => l.id === loanId)?.label ?? loanId}</td>
                  <td className="py-2 pr-4 text-on-surface">
                    {baseComponent ? `${money(baseComponent.amount)} (${outstandingLabel}: ${money(baseComponent.outstanding)})` : "—"}
                  </td>
                  {hasDistinctScenario ? (
                    <td className="py-2 pr-4 text-on-surface">
                      {scenarioComponent ? `${money(scenarioComponent.amount)} (${outstandingLabel}: ${money(scenarioComponent.outstanding)})` : "—"}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
