import { notFound } from "next/navigation";
import { currentAnnualRate, weightedAverageRate } from "../../../engine/metrics/index.js";
import { SUPPORTED_LANGUAGES, type Language } from "../../../lib/i18n/locales.js";
import { getDictionary } from "../../../lib/i18n/getDictionary.js";
import {
  listLoanSummaries,
  getAvailableAccountsForLoanSelect,
  getAvailableContractDocumentsForSelect,
} from "../../../lib/services/loansPageService.js";
import { getSettings } from "../../../lib/services/settingsService.js";
import { getLoanCategoryOptions } from "../../../lib/settings/typeOptions.js";
import { formatDate, formatMoney } from "../../../lib/format.js";
import { Badge } from "../../../components/ui/Badge.js";
import { LoanAmortizationChart } from "../../../components/charts/LoanAmortizationChart.js";
import { NewLoanWizard } from "../../../components/loans/NewLoanWizard.js";
import { ExpenseEntryForm } from "../../../components/loans/ExpenseEntryForm.js";
import { LiveRefresh } from "../../../components/ui/LiveRefresh.js";
import { InlineRecurringItemRow } from "../../../components/ui/InlineRecurringItemRow.js";
import { sumMoney } from "../../../engine/money/money.js";
import { Decimal } from "../../../engine/money/decimal.js";
import { EXPENSE_CATEGORIES } from "../../../domain/expenses/expense.js";
import { listRecurringExpenses } from "../../../lib/services/recurringItemsService.js";
import { serializeLoan } from "../../../domain/loans/loan.js";
import { PrepaymentOptimizerCard } from "../../../components/loans/PrepaymentOptimizerCard.js";
import {
  createLoanAction,
  updateLoanAction,
  deleteLoanAction,
  uploadLoanContractAction,
  extractLoanDraftFromContractAction,
  createRecurringExpenseAction,
  updateRecurringExpenseAction,
  deleteRecurringExpenseAction,
} from "./actions.js";

function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

const CATEGORY_ICON: Record<string, string> = {
  mortgage: "home",
  auto: "directions_car",
  personal: "person",
  consumer: "shopping_cart",
  student: "school",
  other: "account_balance_wallet",
};

export default async function LoansPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLanguage(lang)) notFound();
  const dict = getDictionary(lang);
  const [summaries, accounts, contractDocuments, settings, expenses] = await Promise.all([
    listLoanSummaries(),
    getAvailableAccountsForLoanSelect(),
    getAvailableContractDocumentsForSelect(),
    getSettings(),
    listRecurringExpenses(),
  ]);
  const loanCategoryOptions = getLoanCategoryOptions(settings);
  const loanCategoryLabelMap = new Map(loanCategoryOptions.map((option) => [option.value, option.label]));
  const currency = summaries[0]?.loan.principal.currency ?? "EUR";
  const accountNameMap = new Map(accounts.map((account) => [account.id, account.name]));
  const frequencyLabelMap: Record<string, string> = {
    monthly: dict.wizards.freqMonthly,
    quarterly: dict.wizards.freqQuarterly,
    semiannual: dict.wizards.freqSemiannual,
    annual: dict.wizards.freqAnnual,
    biweekly: dict.wizards.freqBiweekly,
    weekly: dict.wizards.freqWeekly,
    daily: dict.wizards.freqDaily,
  };

  const boundCreate = createLoanAction.bind(null, lang);
  const boundExtractDraft = extractLoanDraftFromContractAction.bind(null, lang);
  const boundUpdate = updateLoanAction.bind(null, lang);
  const boundDelete = deleteLoanAction.bind(null, lang);
  const boundUploadContract = uploadLoanContractAction.bind(null, lang);
  const boundCreateExpense = createRecurringExpenseAction.bind(null, lang);
  const boundUpdateExpense = updateRecurringExpenseAction.bind(null, lang);
  const boundDeleteExpense = deleteRecurringExpenseAction.bind(null, lang);
  const accountOptionsForRows = accounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency }));
  const expenseCategoryOptions = EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category }));
  const serializedLoans = summaries.map((s) => serializeLoan(s.loan));

  const totalLiabilities = summaries.length > 0 ? sumMoney(currency, summaries.map((s) => s.outstandingPrincipal)) : undefined;
  const totalMonthlyPayment =
    summaries.length > 0
      ? sumMoney(currency, summaries.map((s) => s.monthlyPayment).filter((m) => m !== undefined))
      : undefined;

  // Balance-weighted average of the rate each loan charges today: fixed loans their fixed
  // rate, mixed loans their fixed leg until it ends, variable legs index + spread.
  const avgRate = weightedAverageRate(
    summaries.map((s) => ({
      balanceMinorUnits: s.outstandingPrincipal.minorUnits,
      annualRate: currentAnnualRate(s.loan.rate, s.loan.numberOfPeriods - s.remainingPeriods),
    })),
  );
  const weightedAvgRatePercent = avgRate?.mul(Decimal.fromBigInt(100n)).toString();

  return (
    <div className="flex flex-col gap-stack-lg">
      <LiveRefresh scope="loans" />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md page-head border-b border-on-surface pb-5">
        <div>
          <h1 className="text-display-lg-mobile md:text-display-lg text-on-surface">{dict.loans.title}</h1>
          <p className="text-body-lg text-on-surface-variant mt-1">{dict.loans.subtitle}</p>
        </div>
      </div>

      <div className="figure-band grid grid-cols-1 md:grid-cols-3 border-y border-outline-variant divide-y md:divide-y-0 md:divide-x divide-outline-variant">
        <div className="py-4 md:px-5 md:first:pl-0">
          <div className="flex justify-between items-start mb-2">
            <h3 className="eyebrow">{dict.loans.totalLiabilities}</h3>
          </div>
          <div className="figure text-[24px] leading-8 text-on-surface">
            {totalLiabilities ? `-${formatMoney(totalLiabilities, lang)}` : "—"}
          </div>
        </div>
        <div className="py-4 md:px-5">
          <div className="flex justify-between items-start mb-2">
            <h3 className="eyebrow">{dict.loans.avgInterestRate}</h3>
          </div>
          <div className="figure text-[24px] leading-8 text-on-surface">
            {weightedAvgRatePercent !== undefined ? `${Number(weightedAvgRatePercent).toFixed(2)}%` : "—"}
          </div>
        </div>
        <div className="py-4 md:px-5">
          <div className="flex justify-between items-start mb-2">
            <h3 className="eyebrow">{dict.loans.totalMonthlyPayment}</h3>
          </div>
          <div className="figure text-[24px] leading-8 text-on-surface">
            {totalMonthlyPayment ? formatMoney(totalMonthlyPayment, lang) : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {summaries.map(({ loan, outstandingPrincipal, monthlyPayment, remainingPeriods, totalInterestRemaining, rateDataMissing, chartData, contractDocumentName }) => {
          const payoffPercent = Math.round((1 - remainingPeriods / loan.numberOfPeriods) * 100);
          const rateTypeInput = loan.rate.type === "mixed" ? "mixed" : loan.rate.type === "variable" ? "variable" : "fixed";
          const fixedRateInput =
            loan.rate.type === "fixed"
              ? (Number(loan.rate.annualRate.toString()) * 100).toFixed(2)
              : loan.rate.type === "mixed"
                ? (Number(loan.rate.fixedAnnualRate.toString()) * 100).toFixed(2)
                : "4.00";
          const euriborRateInput =
            loan.rate.type === "fixed" ? "2.00" : (Number(loan.rate.currentIndexRate.toString()) * 100).toFixed(2);
          const spreadInput =
            loan.rate.type === "fixed" ? "1.00" : (Number(loan.rate.spread.toString()) * 100).toFixed(2);
          const fixedRatePeriodsInput = loan.rate.type === "mixed" ? String(loan.rate.fixedPeriodCount) : "12";

          return (
            <div key={loan.id} className="bg-surface-container-lowest border border-outline-variant rounded-sm p-stack-lg shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-stack-md border-b border-outline-variant pb-stack-md">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-headline-sm text-on-surface">{loan.name}</h3>
                    <p className="text-label-sm text-on-surface-variant capitalize">{loanCategoryLabelMap.get(loan.category) ?? loan.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {rateDataMissing ? (
                    <Badge tone="warning">{dict.loans.rateDataMissing}</Badge>
                  ) : (
                    <span className="text-label-sm text-on-surface-variant bg-surface-container px-2 py-1 rounded-sm">
                      {loan.rate.type === "fixed" ? dict.loans.fixed : loan.rate.type === "mixed" ? "Mixed" : dict.loans.variable}
                    </span>
                  )}
                  <form action={boundDelete}>
                    <input type="hidden" name="loanId" value={loan.id} />
                    <button
                      type="submit"
                      aria-label={dict.loans.deleteLoan}
                      title={dict.loans.deleteLoan}
                      className="w-9 h-9 rounded-sm border border-outline-variant text-on-surface-variant hover:text-status-danger hover:border-status-danger hover:bg-surface-container-low transition-colors flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        delete
                      </span>
                    </button>
                  </form>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-stack-md mb-stack-lg flex-grow">
                <div>
                  <p className="text-label-sm text-on-surface-variant mb-1">{dict.loans.principal}</p>
                  <p className="text-headline-sm text-on-surface">{formatMoney(loan.principal, lang)}</p>
                </div>
                <div className="text-right">
                  <p className="text-label-sm text-on-surface-variant mb-1">{dict.loans.monthlyPayment}</p>
                  <p className="text-headline-sm text-on-surface">{monthlyPayment ? formatMoney(monthlyPayment, lang) : "—"}</p>
                </div>
                <div>
                  <p className="text-label-sm text-on-surface-variant mb-1">{dict.loans.outstandingBalance}</p>
                  <p className="text-body-md text-on-surface font-medium">{formatMoney(outstandingPrincipal, lang)}</p>
                </div>
                <div className="text-right">
                  <p className="text-label-sm text-on-surface-variant mb-1">{dict.loans.rate}</p>
                  <p className="text-body-md text-on-surface font-medium">
                    {loan.rate.type === "fixed"
                      ? `${(Number(loan.rate.annualRate.toString()) * 100).toFixed(2)}% fixed`
                      : loan.rate.type === "variable"
                        ? `${loan.rate.index}: ${(Number(loan.rate.currentIndexRate.toString()) * 100).toFixed(2)}% + ${(Number(loan.rate.spread.toString()) * 100).toFixed(2)}%`
                        : `${(Number(loan.rate.fixedAnnualRate.toString()) * 100).toFixed(2)}% fixed, then ${loan.rate.index} + ${(Number(loan.rate.spread.toString()) * 100).toFixed(2)}%`}
                  </p>
                </div>
                <div>
                  <p className="text-label-sm text-on-surface-variant mb-1">{dict.loans.totalInterest}</p>
                  <p className="text-body-md text-on-surface font-medium">
                    {totalInterestRemaining ? formatMoney(totalInterestRemaining, lang) : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-label-sm text-on-surface-variant mb-1">{dict.loans.startDate}</p>
                  <p className="text-body-md text-on-surface font-medium">{formatDate(loan.startDate.toString(), lang)}</p>
                </div>
                <div>
                  <p className="text-label-sm text-on-surface-variant mb-1">{dict.loans.associatedContract}</p>
                  <p className="text-body-md text-on-surface font-medium truncate">{contractDocumentName ?? dict.loans.noContract}</p>
                </div>
              </div>

              <div className="mt-auto pt-stack-md border-t border-outline-variant">
                <div className="flex justify-between text-label-sm mb-2">
                  <span className="text-on-surface-variant">{dict.loans.payoffProgress}</span>
                  <span className="text-on-surface">{payoffPercent}%</span>
                </div>
                <div className="w-full h-2 bg-surface-container-high overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${payoffPercent}%` }} />
                </div>
              </div>

              <details className="mt-stack-md pt-stack-md border-t border-outline-variant">
                <summary className="text-label-sm text-primary cursor-pointer select-none">{dict.loans.editLoan}</summary>
                <form action={boundUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-stack-sm mt-stack-sm">
                  <input type="hidden" name="loanId" value={loan.id} />
                  <label className="flex flex-col gap-1 eyebrow">
                    {dict.loans.name}
                    <input
                      name="name"
                      required
                      defaultValue={loan.name}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1 eyebrow">
                    {dict.loans.category}
                    <select
                      name="category"
                      defaultValue={loan.category}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    >
                      {loanCategoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 eyebrow">
                    {dict.loans.principal} ({loan.principal.currency})
                    <input
                      type="number"
                      step="0.01"
                      name="principalAmount"
                      required
                      defaultValue={loan.principal.toDecimalString()}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1 eyebrow">
                    {dict.wizards.currency}
                    <input
                      name="currency"
                      required
                      defaultValue={loan.principal.currency}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1 eyebrow">
                    {dict.loans.startDate}
                    <input
                      type="date"
                      name="startDate"
                      required
                      defaultValue={loan.startDate.toString()}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1 eyebrow">
                    {dict.loans.remainingTerm}
                    <input
                      type="number"
                      min={1}
                      step={1}
                      name="numberOfPeriods"
                      required
                      defaultValue={loan.numberOfPeriods}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1 eyebrow">
                    {dict.wizards.paymentFrequency}
                    <select
                      name="paymentFrequency"
                      defaultValue={loan.paymentFrequency}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    >
                      <option value="monthly">{dict.wizards.freqMonthly}</option>
                      <option value="quarterly">{dict.wizards.freqQuarterly}</option>
                      <option value="semiannual">{dict.wizards.freqSemiannual}</option>
                      <option value="annual">{dict.wizards.freqAnnual}</option>
                      <option value="biweekly">{dict.wizards.freqBiweekly}</option>
                      <option value="weekly">{dict.wizards.freqWeekly}</option>
                      <option value="daily">{dict.wizards.freqDaily}</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 eyebrow">
                    {dict.wizards.amortization}
                    <select
                      name="amortizationType"
                      defaultValue={loan.amortizationType}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    >
                      <option value="french">{dict.wizards.amortFrench}</option>
                      <option value="constant_amortization">{dict.wizards.amortConstant}</option>
                      <option value="interest_only">{dict.wizards.amortInterestOnly}</option>
                    </select>
                  </label>
                  {loan.category === "mortgage" ? (
                    <>
                      <label className="flex flex-col gap-1 eyebrow">
                        {dict.wizards.rateType}
                        <select
                          name="rateType"
                          defaultValue={rateTypeInput}
                          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                        >
                          <option value="fixed">{dict.wizards.rateFixed}</option>
                          <option value="variable">{dict.wizards.rateVariable}</option>
                          <option value="mixed">{dict.wizards.rateMixed}</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 eyebrow">
                        {dict.wizards.fixedRate}
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          name="fixedRate"
                          required
                          defaultValue={fixedRateInput}
                          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                        />
                      </label>
                      <label className="flex flex-col gap-1 eyebrow">
                        {dict.wizards.euriborRate}
                        <input
                          type="number"
                          step="0.01"
                          name="euriborRate"
                          defaultValue={euriborRateInput}
                          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                        />
                      </label>
                      <label className="flex flex-col gap-1 eyebrow">
                        {dict.wizards.spread}
                        <input
                          type="number"
                          step="0.01"
                          name="spread"
                          defaultValue={spreadInput}
                          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                        />
                      </label>
                      <label className="flex flex-col gap-1 eyebrow">
                        {dict.wizards.fixedRatePeriods}
                        <input
                          type="number"
                          min={1}
                          step={1}
                          name="fixedRatePeriods"
                          defaultValue={fixedRatePeriodsInput}
                          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="rateType" value="fixed" />
                      <label className="flex flex-col gap-1 eyebrow">
                        {dict.loans.rate} (%)
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          name="fixedRate"
                          required
                          defaultValue={fixedRateInput}
                          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                        />
                      </label>
                    </>
                  )}
                  <input type="hidden" name="sourceAccountId" value={loan.sourceAccountId} />
                  <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant md:col-span-2">
                    {dict.loans.associatedContract}
                    <select
                      name="contractDocumentId"
                      defaultValue={loan.contractDocumentId ?? ""}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    >
                      <option value="">{dict.loans.noContract}</option>
                      {contractDocuments.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.fileName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="submit" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md">
                      {dict.loans.saveLoan}
                    </button>
                  </div>
                </form>

                <form action={boundDelete} className="mt-stack-sm">
                  <input type="hidden" name="loanId" value={loan.id} />
                  <button type="submit" className="text-label-sm text-status-danger">
                    {dict.loans.deleteLoan}
                  </button>
                </form>

                <form action={boundUploadContract} className="mt-stack-sm flex flex-col gap-2">
                  <input type="hidden" name="loanId" value={loan.id} />
                  <label className="flex flex-col gap-1 eyebrow">
                    {dict.loans.associatedContract}
                    <input
                      type="file"
                      name="file"
                      accept="application/pdf"
                      required
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    />
                  </label>
                  <div className="flex justify-end">
                    <button type="submit" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md">
                      {dict.upload.title}
                    </button>
                  </div>
                </form>
              </details>

              {chartData ? (
                <details className="mt-stack-md">
                  <summary className="text-label-md text-primary cursor-pointer select-none">{dict.loans.viewSchedule}</summary>
                  <div className="mt-stack-sm">
                    <LoanAmortizationChart data={chartData} interestLabel={dict.loans.chartInterest} principalLabel={dict.loans.chartPrincipal} />
                  </div>
                </details>
              ) : null}
            </div>
          );
        })}

        <details className="self-start border border-dashed border-outline rounded-sm p-5 flex flex-col items-center justify-center min-h-[72px] group [&_summary]:list-none">
          <summary className="cursor-pointer select-none flex flex-col items-center text-center">
            <span className="text-label-md text-on-surface-variant group-hover:text-on-surface transition-colors border-b border-outline-variant group-hover:border-on-surface pb-0.5"><span className="font-mono text-primary mr-1.5">+</span>
              {dict.loans.addLoan}
            </span>
          </summary>

          <NewLoanWizard
            createAction={boundCreate}
            extractAction={boundExtractDraft}
            accounts={accounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency }))}
            defaultCurrency={currency}
            loanCategoryOptions={loanCategoryOptions}
            labels={{
              addLoan: dict.loans.addLoan,
              name: dict.loans.name,
              category: dict.loans.category,
              principal: dict.loans.principal,
              startDate: dict.loans.startDate,
              remainingTerm: dict.loans.remainingTerm,
              rate: dict.loans.rate,
              saveLoan: dict.loans.saveLoan,
              sourceAccount: dict.loans.sourceAccount,
            }}
            text={dict.wizards}
            ambiguousWarningLabel={dict.wizards.ambiguousFieldWarning}
          />
        </details>

        <details className="self-start border border-dashed border-outline rounded-sm p-5 flex flex-col items-center justify-center min-h-[72px] group [&_summary]:list-none">
          <summary className="cursor-pointer select-none flex flex-col items-center text-center">
            <span className="text-label-md text-on-surface-variant group-hover:text-on-surface transition-colors border-b border-outline-variant group-hover:border-on-surface pb-0.5"><span className="font-mono text-primary mr-1.5">+</span>
              {dict.loans.addRecurringExpense}
            </span>
          </summary>
          <ExpenseEntryForm
            action={boundCreateExpense}
            accounts={accounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency }))}
            categories={EXPENSE_CATEGORIES}
            labels={{
              sourceAccount: dict.loans.sourceAccount,
              expenseAmount: dict.loans.expenseAmount,
              expenseFrequency: dict.loans.expenseFrequency,
              expenseCategory: dict.loans.expenseCategory,
              expenseStartDate: dict.loans.expenseStartDate,
              saveExpense: dict.loans.saveRecurringExpense,
              schedule: dict.loans.schedule,
              scheduleRecurring: dict.loans.scheduleRecurring,
              scheduleOneOff: dict.loans.scheduleOneOff,
              freqMonthly: dict.wizards.freqMonthly,
              freqQuarterly: dict.wizards.freqQuarterly,
              freqSemiannual: dict.wizards.freqSemiannual,
              freqAnnual: dict.wizards.freqAnnual,
              freqBiweekly: dict.wizards.freqBiweekly,
              freqWeekly: dict.wizards.freqWeekly,
              freqDaily: dict.wizards.freqDaily,
            }}
          />
        </details>
      </div>

      {summaries.length === 0 ? <p className="text-body-md text-on-surface-variant">{dict.loans.empty}</p> : null}

      {summaries.length > 0 ? (
        <PrepaymentOptimizerCard
          serializedLoans={serializedLoans}
          currency={currency}
          lang={lang}
          labels={{
            title: dict.loans.optimizerTitle,
            deterministic: dict.loans.deterministic,
            subtitle: dict.loans.optimizerSubtitle,
            lumpSum: dict.loans.optimizerLumpSum,
            strategy: dict.loans.optimizerStrategy,
            reducePayment: dict.loans.optimizerReducePayment,
            shortenTerm: dict.loans.optimizerShortenTerm,
            rank: dict.loans.optimizerRank,
            bestOption: dict.loans.optimizerBestOption,
            interestSaved: dict.loans.optimizerInterestSaved,
            netSavings: dict.loans.optimizerNetSavings,
            penalty: dict.loans.optimizerPenalty,
            paymentDrop: dict.loans.optimizerPaymentDrop,
            termShortened: dict.loans.optimizerTermShortened,
            months: dict.loans.optimizerMonths,
            simulate: dict.loans.optimizerSimulate,
            noLoans: dict.loans.optimizerNoLoans,
          }}
        />
      ) : null}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-sm p-6">
        <h2 className="text-headline-sm text-on-surface mb-stack-md">{dict.loans.recurringExpensesTitle}</h2>
        {expenses.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">{dict.loans.noRecurringExpenses}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-md">
              <thead>
                <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant">
                  <th className="py-2 pr-4 font-normal">{dict.loans.account}</th>
                  <th className="py-2 pr-4 font-normal">{dict.loans.expenseAmount}</th>
                  <th className="py-2 pr-4 font-normal">{dict.loans.expenseFrequency}</th>
                  <th className="py-2 pr-4 font-normal">{dict.loans.expenseCategory}</th>
                  <th className="py-2 pr-4 font-normal">{dict.loans.expenseStartDate}</th>
                  <th className="py-2 pr-4 font-normal">{dict.loans.endDate}</th>
                  <th className="py-2 pr-4 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <InlineRecurringItemRow
                    key={expense.id}
                    id={expense.id}
                    idFieldName="expenseId"
                    accountId={expense.accountId}
                    accountName={accountNameMap.get(expense.accountId) ?? expense.accountId}
                    amount={expense.amount.toDecimalString()}
                    formattedAmount={formatMoney(expense.amount, lang)}
                    currency={expense.amount.currency}
                    frequency={expense.frequency}
                    frequencyLabel={frequencyLabelMap[expense.frequency] ?? expense.frequency}
                    category={expense.category}
                    categoryLabel={expense.category}
                    startDate={expense.startDate.toString()}
                    {...(expense.endDate ? { endDate: expense.endDate.toString() } : {})}
                    accounts={accountOptionsForRows}
                    categoryOptions={expenseCategoryOptions}
                    updateAction={boundUpdateExpense}
                    deleteAction={boundDeleteExpense}
                    labels={{
                      account: dict.loans.account,
                      amount: dict.loans.expenseAmount,
                      frequency: dict.loans.expenseFrequency,
                      category: dict.loans.expenseCategory,
                      startDate: dict.loans.expenseStartDate,
                      endDate: dict.loans.endDate,
                      ongoing: dict.loans.ongoing,
                      edit: dict.accounts.edit,
                      save: dict.accounts.save,
                      cancel: dict.loans.cancel,
                      delete: dict.accounts.delete,
                      freqMonthly: dict.wizards.freqMonthly,
                      freqQuarterly: dict.wizards.freqQuarterly,
                      freqSemiannual: dict.wizards.freqSemiannual,
                      freqAnnual: dict.wizards.freqAnnual,
                      freqBiweekly: dict.wizards.freqBiweekly,
                      freqWeekly: dict.wizards.freqWeekly,
                      freqDaily: dict.wizards.freqDaily,
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
