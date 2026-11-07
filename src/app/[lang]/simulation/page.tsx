import { notFound } from "next/navigation";
import { SUPPORTED_LANGUAGES, type Language } from "../../../lib/i18n/locales.js";
import { getDictionary } from "../../../lib/i18n/getDictionary.js";
import { listScenarios, runScenarioAgainstBase, MAX_TIMELINE_MONTH_OFFSET } from "../../../lib/services/scenarioService.js";
import { IsoDate } from "../../../engine/dates/isoDate.js";
import { listAccounts } from "../../../lib/services/accountsService.js";
import { listRecurringIncomes, listRecurringExpenses } from "../../../lib/services/recurringItemsService.js";
import { listLoanSummaries } from "../../../lib/services/loansPageService.js";
import { getIncomeCategoryOptions } from "../../../lib/settings/typeOptions.js";
import { getSettings } from "../../../lib/services/settingsService.js";
import { formatMoney, formatDate, formatMonthYear } from "../../../lib/format.js";
import { SimulationChartCard, type ChartNavigation } from "../../../components/simulation/SimulationChartCard.js";
import { EventEntryForm, type EventEntryFormInitial } from "../../../components/simulation/EventEntryForm.js";
import { EditEventModal } from "../../../components/simulation/EditEventModal.js";
import { type ChartEventMarker } from "../../../components/charts/ComparisonChart.js";
import { Money } from "../../../engine/money/money.js";
import { Decimal } from "../../../engine/money/decimal.js";
import { type SimulationEvent } from "../../../domain/scenarios/scenario.js";
import { createScenarioAction, deleteScenarioAction, addEventAction, updateEventAction, deleteEventAction } from "./actions.js";
import { LiveRefresh } from "../../../components/ui/LiveRefresh.js";

function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

interface EventDescriptionContext {
  accounts: { id: string; name: string; currency: string }[];
  incomes: { id: string; category: string; currency: string }[];
  expenses: { id: string; category: string; currency: string }[];
  loans: { id: string; name: string; currency: string }[];
  lang: Language;
  labels: {
    oneTimeExpense: string;
    oneTimeIncome: string;
    incomeChange: string;
    expenseChange: string;
    prepayment: string;
    rateChange: string;
    until: string;
  };
}

function untilSuffix(endDate: IsoDate | undefined, ctx: EventDescriptionContext): string {
  return endDate ? ` (${ctx.labels.until.replace("{date}", formatDate(endDate.toString(), ctx.lang))})` : "";
}

function describeEvent(event: SimulationEvent, ctx: EventDescriptionContext): string {
  const { payload } = event;
  switch (payload.type) {
    case "one_time_expense": {
      const account = ctx.accounts.find((a) => a.id === payload.accountId);
      return `${ctx.labels.oneTimeExpense}: ${formatMoney(payload.amount, ctx.lang)} — ${account?.name ?? payload.accountId}`;
    }
    case "one_time_income": {
      const account = ctx.accounts.find((a) => a.id === payload.accountId);
      return `${ctx.labels.oneTimeIncome}: ${formatMoney(payload.amount, ctx.lang)} — ${account?.name ?? payload.accountId}`;
    }
    case "income_change": {
      const income = ctx.incomes.find((i) => i.id === payload.incomeId);
      return `${ctx.labels.incomeChange}: ${formatMoney(payload.newAmount, ctx.lang)} — ${income?.category ?? payload.incomeId}${untilSuffix(payload.endDate, ctx)}`;
    }
    case "prepayment": {
      const loan = ctx.loans.find((l) => l.id === payload.loanId);
      return `${ctx.labels.prepayment}: ${formatMoney(payload.amount, ctx.lang)} — ${loan?.name ?? payload.loanId}`;
    }
    case "rate_change": {
      const loan = ctx.loans.find((l) => l.id === payload.loanId);
      const percent = payload.newAnnualValue.mul(Decimal.fromBigInt(100n)).toString();
      return `${ctx.labels.rateChange}: ${payload.index} → ${percent}% — ${loan?.name ?? payload.loanId}`;
    }
    case "expense_change": {
      const expense = ctx.expenses.find((e) => e.id === payload.expenseId);
      return `${ctx.labels.expenseChange}: ${formatMoney(payload.newAmount, ctx.lang)} — ${expense?.category ?? payload.expenseId}${untilSuffix(payload.endDate, ctx)}`;
    }
    case "account_transfer":
      return `${payload.fromAccountId} → ${payload.toAccountId}: ${formatMoney(payload.amount, ctx.lang)}`;
    case "balance_override":
      return `${payload.accountId}: ${formatMoney(payload.newBalance, ctx.lang)}`;
    default: {
      const exhaustive: never = payload;
      return JSON.stringify(exhaustive);
    }
  }
}

function eventFormInitial(event: SimulationEvent): EventEntryFormInitial {
  const { payload } = event;
  const base = { eventId: event.id, date: event.date.toString() };
  switch (payload.type) {
    case "one_time_expense":
    case "one_time_income":
      return { ...base, eventType: payload.type, accountId: payload.accountId, amount: payload.amount.toDecimalString() };
    case "income_change":
      return {
        ...base,
        eventType: "income_change",
        incomeId: payload.incomeId,
        newAmount: payload.newAmount.toDecimalString(),
        ...(payload.endDate ? { endDate: payload.endDate.toString() } : {}),
      };
    case "expense_change":
      return {
        ...base,
        eventType: "expense_change",
        expenseId: payload.expenseId,
        newAmount: payload.newAmount.toDecimalString(),
        ...(payload.endDate ? { endDate: payload.endDate.toString() } : {}),
      };
    case "prepayment":
      return {
        ...base,
        eventType: "prepayment",
        loanId: payload.loanId,
        amount: payload.amount.toDecimalString(),
        strategy: payload.strategy,
      };
    case "rate_change":
      return {
        ...base,
        eventType: "rate_change",
        loanId: payload.loanId,
        newAnnualValuePercent: payload.newAnnualValue.mul(Decimal.fromBigInt(100n)).toString(),
      };
    default:
      return { ...base, eventType: "one_time_expense" };
  }
}

export default async function SimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ scenarioId?: string; monthOffset?: string; editEventId?: string; new?: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLanguage(lang)) notFound();
  const dict = getDictionary(lang);
  const query = await searchParams;

  const requestedMonthOffset = Number(query.monthOffset ?? "0");
  const monthOffset = Number.isFinite(requestedMonthOffset)
    ? Math.min(Math.max(Math.trunc(requestedMonthOffset), -MAX_TIMELINE_MONTH_OFFSET), MAX_TIMELINE_MONTH_OFFSET)
    : 0;

  const [scenarios, accounts, incomes, expenses, loanSummaries, settings] = await Promise.all([
    listScenarios(),
    listAccounts(),
    listRecurringIncomes(),
    listRecurringExpenses(),
    listLoanSummaries(),
    getSettings(),
  ]);
  const incomeCategoryLabelMap = new Map(getIncomeCategoryOptions(settings).map((option) => [option.value, option.label]));
  const selected = query.scenarioId ? scenarios.find((s) => s.id === query.scenarioId) : undefined;
  const result = await runScenarioAgainstBase(selected, monthOffset);
  const accountOptions = accounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency }));
  const incomeOptions = incomes.map((income) => ({
    id: income.id,
    accountId: income.accountId,
    category: incomeCategoryLabelMap.get(income.category) ?? income.category,
    amount: income.amount.toDecimalString(),
    currency: income.amount.currency,
  }));
  const expenseItemOptions = expenses.map((expense) => ({ id: expense.id, label: `${expense.category} — ${accounts.find((a) => a.id === expense.accountId)?.name ?? ""}` }));
  const expenseOptions = expenses.map((expense) => ({
    id: expense.id,
    accountId: expense.accountId,
    category: expense.category,
    amount: expense.amount.toDecimalString(),
    currency: expense.amount.currency,
  }));
  const loanOptions = loanSummaries.map((summary) => ({
    id: summary.loan.id,
    name: summary.loan.name,
    sourceAccountId: summary.loan.sourceAccountId,
    currency: summary.loan.principal.currency,
    ...(summary.loan.rate.type !== "fixed" ? { rateIndex: summary.loan.rate.index } : {}),
  }));
  const loanItemOptions = loanSummaries.map((summary) => ({ id: summary.loan.id, label: summary.loan.name }));

  const effectiveMonthOffset = result.monthOffset;
  const scenarioQueryParam = selected ? `scenarioId=${selected.id}&` : "";
  const monthOffsetHref = (offset: number) =>
    `?${scenarioQueryParam}monthOffset=${Math.min(Math.max(offset, result.minMonthOffset), MAX_TIMELINE_MONTH_OFFSET)}`;
  const navigation: ChartNavigation = {
    label: `${formatMonthYear(result.windowStartDate, lang)} – ${formatMonthYear(result.windowEndDate, lang)}`,
    previousYearHref: monthOffsetHref(effectiveMonthOffset - 12),
    nextYearHref: monthOffsetHref(effectiveMonthOffset + 12),
    previousMonthHref: monthOffsetHref(effectiveMonthOffset - 1),
    nextMonthHref: monthOffsetHref(effectiveMonthOffset + 1),
    atStart: effectiveMonthOffset === result.minMonthOffset,
    atEnd: effectiveMonthOffset === MAX_TIMELINE_MONTH_OFFSET,
    previousYearLabel: dict.simulation.previousYear,
    nextYearLabel: dict.simulation.nextYear,
    previousMonthLabel: dict.simulation.previousMonth,
    nextMonthLabel: dict.simulation.nextMonth,
  };

  const scenarioOptions = [
    { id: "", name: dict.simulation.baseScenario, href: `?monthOffset=${effectiveMonthOffset}` },
    ...scenarios.map((scenario) => ({
      id: scenario.id,
      name: `${scenario.name} (${scenario.events.length} ${dict.simulation.events})`,
      href: `?scenarioId=${scenario.id}&monthOffset=${effectiveMonthOffset}`,
    })),
  ];

  const boundCreate = createScenarioAction.bind(null, lang);
  const boundDelete = deleteScenarioAction.bind(null, lang);
  const boundAddEvent = addEventAction.bind(null, lang);
  const boundUpdateEvent = updateEventAction.bind(null, lang);
  const boundDeleteEvent = deleteEventAction.bind(null, lang);

  const activeImpact = selected ? result.scenarioImpact : result.baseImpact;

  const eventTypeLabel = (payload: SimulationEvent["payload"]): string => {
    switch (payload.type) {
      case "one_time_expense":
        return dict.simulation.oneTimeExpense;
      case "one_time_income":
        return dict.simulation.oneTimeIncome;
      case "income_change":
        return dict.simulation.incomeChange;
      case "expense_change":
        return dict.simulation.expenseChange;
      case "prepayment":
        return dict.simulation.prepayment;
      case "rate_change":
        return dict.simulation.rateChange;
      default:
        return payload.type;
    }
  };
  const activeProjection = result.scenarioProjection.length > 0 ? result.scenarioProjection : result.baseProjection;
  const windowStart = IsoDate.fromString(result.windowStartDate);
  const eventDescriptionCtx: EventDescriptionContext = {
    accounts: accountOptions,
    incomes: incomeOptions,
    expenses: expenseOptions,
    loans: loanOptions,
    lang,
    labels: {
      oneTimeExpense: dict.simulation.oneTimeExpense,
      oneTimeIncome: dict.simulation.oneTimeIncome,
      incomeChange: dict.simulation.incomeChange,
      expenseChange: dict.simulation.expenseChange,
      prepayment: dict.simulation.prepayment,
      rateChange: dict.simulation.rateChange,
      until: dict.simulation.until,
    },
  };
  const eventMarkers: ChartEventMarker[] = selected
    ? selected.events
        .map((event) => (event.date.year - windowStart.year) * 12 + (event.date.month - windowStart.month))
        .map((monthIndex, i) => ({ event: selected.events[i]!, monthIndex }))
        .filter(({ monthIndex }) => monthIndex >= 0 && monthIndex <= 11)
        .map(({ event, monthIndex }) => ({
          monthInYear: monthIndex + 1,
          label: eventTypeLabel(event.payload),
          date: formatDate(event.date.toString(), lang),
          description: describeEvent(event, eventDescriptionCtx),
          ...(activeProjection[monthIndex]?.effortRatePercent !== undefined
            ? { effortRatePercent: activeProjection[monthIndex]!.effortRatePercent }
            : {}),
          ...(result.baseProjection[monthIndex]?.totalLiquidity !== undefined
            ? { baseLiquidity: result.baseProjection[monthIndex]!.totalLiquidity }
            : {}),
          ...(activeProjection[monthIndex]?.totalLiquidity !== undefined
            ? { scenarioLiquidity: activeProjection[monthIndex]!.totalLiquidity }
            : {}),
        }))
    : [];

  const editingEvent = selected && query.editEventId ? selected.events.find((e) => e.id === query.editEventId) : undefined;
  const cancelEditHref = `?scenarioId=${selected?.id ?? ""}`;
  const eventForm = selected ? (
    <>
      <h5 className="text-label-md text-on-surface font-semibold mb-3">
        {editingEvent ? dict.simulation.edit : dict.simulation.addEventTo} &ldquo;{selected.name}&rdquo;
      </h5>
      <EventEntryForm
        action={editingEvent ? boundUpdateEvent : boundAddEvent}
        scenarioId={selected.id}
        accounts={accountOptions}
        incomes={incomeOptions}
        expenses={expenseOptions}
        loans={loanOptions}
        defaultCurrency={result.currency}
        {...(editingEvent ? { initial: eventFormInitial(editingEvent), onCancelHref: cancelEditHref } : {})}
        labels={{
          eventType: dict.simulation.eventType,
          oneTimeExpense: dict.simulation.oneTimeExpense,
          oneTimeIncome: dict.simulation.oneTimeIncome,
          incomeChange: dict.simulation.incomeChange,
          expenseChange: dict.simulation.expenseChange,
          prepayment: dict.simulation.prepayment,
          rateChange: dict.simulation.rateChange,
          account: dict.simulation.account,
          amount: dict.simulation.amount,
          date: dict.simulation.date,
          endDate: dict.simulation.endDate,
          endDateHint: dict.simulation.endDateHint,
          income: dict.simulation.income,
          expense: dict.simulation.expense,
          newAmount: dict.simulation.newAmount,
          newAmountHint: dict.simulation.newAmountHint,
          newExpenseAmountHint: dict.simulation.newExpenseAmountHint,
          loan: dict.simulation.loan,
          strategy: dict.simulation.strategy,
          reducePayment: dict.simulation.reducePayment,
          shortenTerm: dict.simulation.shortenTerm,
          prepaymentAmount: dict.simulation.prepaymentAmount,
          newRatePercent: dict.simulation.newRatePercent,
          newRatePercentHint: dict.simulation.newRatePercentHint,
          addEvent: dict.simulation.addEvent,
          save: dict.simulation.save,
          cancel: dict.simulation.cancel,
        }}
      />
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-stack-lg">
      <LiveRefresh scope="accounts" />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 page-head border-b border-on-surface pb-5">
        <div>
          <h2 className="text-display-lg-mobile md:text-display-lg text-on-surface">{dict.simulation.title}</h2>
          <p className="text-body-lg text-on-surface-variant mt-2">{dict.simulation.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="eyebrow">{dict.simulation.activeScenario}</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-primary" />
            <span className="text-label-md text-on-surface">{selected ? selected.name : dict.simulation.baseScenario}</span>
          </div>
        </div>
      </div>

      {/* Liquidity projection */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-headline-sm text-on-surface">{dict.simulation.liquidityProjection}</h3>
        </div>
        <SimulationChartCard
          base={result.baseProjection}
          scenario={result.scenarioProjection}
          baseLabel={dict.simulation.baseScenario}
          scenarioLabel={selected ? selected.name : dict.simulation.baseScenario}
          incomeLabel={dict.simulation.incomeLegend}
          loanPaymentsLabel={dict.simulation.loanPaymentsLegend}
          expensesLabel={dict.simulation.expensesLegend}
          ratePercentLabel={dict.simulation.ratePercentLabel}
          effortRatePercentLabel={dict.simulation.dtiShortLabel}
          events={eventMarkers}
          actual={result.actualLiquidity}
          actualLabel={dict.dashboard.balanceDriftActual}
          eventEffectTitle={dict.simulation.eventEffectTitle}
          closeLabel={dict.common.close}
          emptyLabel={dict.simulation.empty}
          effortRateTitle={dict.simulation.effortRateDti}
          toneLabels={{ healthy: dict.common.healthy, warning: dict.common.warning, critical: dict.common.critical }}
          accounts={accountOptions}
          incomeItems={incomeOptions.map((income) => ({ id: income.id, label: income.category }))}
          expenseItems={expenseItemOptions}
          loanItems={loanItemOptions}
          currency={result.currency}
          lang={lang}
          accountBalancesTitle={dict.simulation.accountBalancesTitle}
          summaryTitle={dict.simulation.summaryTitle}
          maximizeLabel={dict.simulation.maximize}
          minimizeLabel={dict.simulation.minimize}
          navigation={navigation}
          currentDebtLabel={dict.simulation.currentDebtLabel}
          monthlyPaymentLabel={dict.simulation.monthlyPaymentLabel}
          euriborLabel={dict.simulation.euriborLabel}
          incomeComponentsLabel={dict.simulation.incomeComponentsLabel}
          negativeBalanceWarning={dict.simulation.negativeBalanceWarning}
          scenarioOptions={scenarioOptions}
          selectedScenarioId={selected?.id ?? ""}
          scenarioSelectorLabel={dict.simulation.activeScenario}
          solvencyRiskTitle={dict.simulation.solvencyRiskTitle}
          expenseComponentsLabel={dict.simulation.expenseComponentsLabel}
          loanComponentsLabel={dict.simulation.loanComponentsLabel}
          outstandingLabel={dict.simulation.outstandingLabel}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left: Liquidity Impact */}
        <div className="lg:col-span-5 flex flex-col gap-gutter">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <h4 className="text-label-md text-on-surface font-semibold">{dict.simulation.liquidityImpact}</h4>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-end border-b border-outline-variant pb-2">
                <span className="eyebrow">{dict.simulation.availableLiquidityNow}</span>
                <span className="text-headline-sm text-on-surface">
                  {formatMoney(Money.fromDecimalString(activeImpact.availableLiquidityNow, result.currency), lang)}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="eyebrow">{dict.simulation.projectedMinimumLiquidity}</span>
                <span className="text-headline-sm text-on-surface">
                  {formatMoney(Money.fromDecimalString(activeImpact.projectedMinimumLiquidity, result.currency), lang)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Scenario management + event form */}
        <div className="lg:col-span-7 flex flex-col gap-gutter">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-sm p-6">
            <h4 className="text-headline-sm text-on-surface mb-4">{dict.simulation.scenarios}</h4>
            {scenarios.length === 0 ? (
              <p className="text-body-md text-on-surface-variant mb-stack-md">{dict.simulation.noScenariosYet}</p>
            ) : (
              <ul className="flex flex-col gap-stack-sm mb-stack-md">
                {scenarios.map((scenario) => (
                  <li
                    key={scenario.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 border ${scenario.id === selected?.id ? "border-primary bg-surface-container-low" : "border-outline-variant"}`}
                  >
                    <a
                      href={`?scenarioId=${scenario.id}`}
                      className={`text-body-md ${scenario.id === selected?.id ? "text-primary font-semibold" : "text-on-surface"}`}
                    >
                      {scenario.name} ({scenario.events.length} {dict.simulation.events})
                    </a>
                    <form action={boundDelete}>
                      <input type="hidden" name="scenarioId" value={scenario.id} />
                      <button type="submit" className="text-label-sm text-status-danger">
                        {dict.simulation.delete}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={boundCreate} className="flex gap-stack-sm">
              <input
                name="name"
                placeholder={dict.simulation.newScenarioNamePlaceholder}
                required
                // Sidebar "New Analysis" lands here with ?new=1 — jump straight to naming one.
                autoFocus={query.new === "1"}
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md flex-1 focus:outline-none focus:border-primary"
              />
              <button type="submit" className="bg-primary text-on-primary rounded-lg px-4 py-2 text-label-md font-medium hover:opacity-90 transition-opacity">
                {dict.simulation.create}
              </button>
            </form>
          </div>

          {selected ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-sm p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-6 border-b border-outline-variant pb-4">
                <h4 className="text-headline-sm text-on-surface">{dict.simulation.scenarioEvents}</h4>
              </div>

              {selected.events.length === 0 ? (
                <p className="text-body-md text-on-surface-variant mb-stack-md">{dict.simulation.noEventsYet}</p>
              ) : (
                <ul className="flex flex-col gap-stack-sm mb-stack-md">
                  {selected.events.map((event) => (
                    <li
                      key={event.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 border gap-3 ${event.id === editingEvent?.id ? "border-primary bg-surface-container-low" : "border-outline-variant"}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-body-md text-on-surface">{describeEvent(event, eventDescriptionCtx)}</span>
                        <span className="eyebrow">{formatDate(event.date.toString(), lang)}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <a href={`?scenarioId=${selected.id}&editEventId=${event.id}`} className="text-label-sm text-primary">
                          {dict.simulation.edit}
                        </a>
                        <form action={boundDeleteEvent}>
                          <input type="hidden" name="scenarioId" value={selected.id} />
                          <input type="hidden" name="eventId" value={event.id} />
                          <button type="submit" className="text-label-sm text-status-danger">
                            {dict.simulation.delete}
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {editingEvent ? (
                <EditEventModal cancelHref={cancelEditHref}>{eventForm}</EditEventModal>
              ) : (
                <div className="border-t border-outline-variant pt-4">{eventForm}</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
