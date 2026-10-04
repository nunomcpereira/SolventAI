"use client";

import { useState } from "react";

type EventType = "one_time_expense" | "one_time_income" | "income_change" | "expense_change" | "prepayment" | "rate_change";

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

interface IncomeOption {
  id: string;
  accountId: string;
  category: string;
  amount: string;
  currency: string;
}

interface ExpenseOption {
  id: string;
  accountId: string;
  category: string;
  amount: string;
  currency: string;
}

interface LoanOption {
  id: string;
  name: string;
  sourceAccountId: string;
  currency: string;
  /** Present only for variable/mixed-rate loans — the external index their rate references (e.g. "EURIBOR_6M"). */
  rateIndex?: string;
}

interface EventEntryFormLabels {
  eventType: string;
  oneTimeExpense: string;
  oneTimeIncome: string;
  incomeChange: string;
  expenseChange: string;
  prepayment: string;
  rateChange: string;
  account: string;
  amount: string;
  date: string;
  endDate: string;
  endDateHint: string;
  income: string;
  expense: string;
  newAmount: string;
  newAmountHint: string;
  newExpenseAmountHint: string;
  loan: string;
  strategy: string;
  reducePayment: string;
  shortenTerm: string;
  prepaymentAmount: string;
  newRatePercent: string;
  newRatePercentHint: string;
  addEvent: string;
  save: string;
  cancel: string;
}

export interface EventEntryFormInitial {
  eventId: string;
  eventType: EventType;
  date: string;
  accountId?: string;
  amount?: string;
  incomeId?: string;
  expenseId?: string;
  newAmount?: string;
  endDate?: string;
  loanId?: string;
  strategy?: string;
  newAnnualValuePercent?: string;
}

export function EventEntryForm({
  action,
  scenarioId,
  accounts,
  incomes,
  expenses,
  loans,
  defaultCurrency,
  labels,
  initial,
  onCancelHref,
}: {
  action: (formData: FormData) => Promise<void>;
  scenarioId: string;
  accounts: AccountOption[];
  incomes: IncomeOption[];
  expenses: ExpenseOption[];
  loans: LoanOption[];
  defaultCurrency: string;
  labels: EventEntryFormLabels;
  /** Prefills the form and switches it into edit mode when set. */
  initial?: EventEntryFormInitial;
  /** Shown next to the submit button in edit mode; navigates back out of edit mode. */
  onCancelHref?: string;
}) {
  const [eventType, setEventType] = useState<EventType>(initial?.eventType ?? "one_time_expense");
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const [incomeId, setIncomeId] = useState(initial?.incomeId ?? incomes[0]?.id ?? "");
  const [expenseId, setExpenseId] = useState(initial?.expenseId ?? expenses[0]?.id ?? "");
  const [loanId, setLoanId] = useState(initial?.loanId ?? loans[0]?.id ?? "");

  const selectedAccountCurrency = accounts.find((a) => a.id === accountId)?.currency ?? defaultCurrency;
  const selectedIncomeCurrency = incomes.find((i) => i.id === incomeId)?.currency ?? defaultCurrency;
  const selectedExpenseCurrency = expenses.find((e) => e.id === expenseId)?.currency ?? defaultCurrency;
  const selectedLoan = loans.find((l) => l.id === loanId);
  const rateChangeLoans = loans.filter((l) => l.rateIndex !== undefined);
  const selectedRateChangeLoan = rateChangeLoans.find((l) => l.id === loanId) ?? rateChangeLoans[0];

  return (
    <form action={action} className="flex flex-wrap gap-stack-md items-end">
      <input type="hidden" name="scenarioId" value={scenarioId} />
      <input type="hidden" name="eventType" value={eventType} />
      {initial ? <input type="hidden" name="eventId" value={initial.eventId} /> : null}
      {eventType === "prepayment" ? (
        <input type="hidden" name="sourceAccountId" value={selectedLoan?.sourceAccountId ?? ""} />
      ) : null}
      {eventType === "rate_change" ? (
        <input type="hidden" name="index" value={selectedRateChangeLoan?.rateIndex ?? ""} />
      ) : null}
      <input
        type="hidden"
        name="currency"
        value={
          eventType === "income_change"
            ? selectedIncomeCurrency
            : eventType === "expense_change"
              ? selectedExpenseCurrency
              : eventType === "prepayment"
                ? selectedLoan?.currency ?? defaultCurrency
                : selectedAccountCurrency
        }
      />

      <label className="flex flex-col gap-1 text-label-md text-on-surface flex-1 min-w-[180px]">
        {labels.eventType}
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as EventType)}
          className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low focus:outline-none focus:border-primary"
        >
          <option value="one_time_expense">{labels.oneTimeExpense}</option>
          <option value="one_time_income">{labels.oneTimeIncome}</option>
          <option value="income_change">{labels.incomeChange}</option>
          <option value="expense_change">{labels.expenseChange}</option>
          <option value="prepayment">{labels.prepayment}</option>
          <option value="rate_change">{labels.rateChange}</option>
        </select>
      </label>

      {eventType === "one_time_expense" || eventType === "one_time_income" ? (
        <>
          <label className="flex flex-col gap-1 text-label-md text-on-surface flex-1 min-w-[140px]">
            {labels.account}
            <select
              name="accountId"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low focus:outline-none focus:border-primary"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label-md text-on-surface">
            {labels.amount} ({selectedAccountCurrency})
            <input
              type="number"
              step="0.01"
              name="amount"
              defaultValue={initial?.amount ?? "1000"}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low w-32 focus:outline-none focus:border-primary"
            />
          </label>
        </>
      ) : null}

      {eventType === "income_change" ? (
        <>
          <label className="flex flex-col gap-1 text-label-md text-on-surface flex-1 min-w-[180px]">
            {labels.income}
            <select
              name="incomeId"
              value={incomeId}
              onChange={(e) => setIncomeId(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low focus:outline-none focus:border-primary"
            >
              {incomes.map((income) => (
                <option key={income.id} value={income.id}>
                  {income.category} — {income.amount} {income.currency}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label-md text-on-surface">
            {labels.newAmount} ({selectedIncomeCurrency})
            <input
              type="number"
              step="0.01"
              min="0"
              name="newAmount"
              defaultValue={initial?.newAmount ?? "0"}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low w-32 focus:outline-none focus:border-primary"
            />
            <span className="text-label-sm text-on-surface-variant font-normal max-w-[220px]">{labels.newAmountHint}</span>
          </label>
        </>
      ) : null}

      {eventType === "expense_change" ? (
        <>
          <label className="flex flex-col gap-1 text-label-md text-on-surface flex-1 min-w-[180px]">
            {labels.expense}
            <select
              name="expenseId"
              value={expenseId}
              onChange={(e) => setExpenseId(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low focus:outline-none focus:border-primary"
            >
              {expenses.map((expense) => (
                <option key={expense.id} value={expense.id}>
                  {expense.category} — {expense.amount} {expense.currency}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label-md text-on-surface">
            {labels.newAmount} ({selectedExpenseCurrency})
            <input
              type="number"
              step="0.01"
              min="0"
              name="newAmount"
              defaultValue={initial?.newAmount ?? "0"}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low w-32 focus:outline-none focus:border-primary"
            />
            <span className="text-label-sm text-on-surface-variant font-normal max-w-[220px]">{labels.newExpenseAmountHint}</span>
          </label>
        </>
      ) : null}

      {eventType === "prepayment" ? (
        <>
          <label className="flex flex-col gap-1 text-label-md text-on-surface flex-1 min-w-[180px]">
            {labels.loan}
            <select
              name="loanId"
              value={loanId}
              onChange={(e) => setLoanId(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low focus:outline-none focus:border-primary"
            >
              {loans.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  {loan.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label-md text-on-surface">
            {labels.prepaymentAmount} ({selectedLoan?.currency ?? defaultCurrency})
            <input
              type="number"
              step="0.01"
              min="0.01"
              name="amount"
              defaultValue={initial?.amount ?? "1000"}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low w-32 focus:outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-label-md text-on-surface">
            {labels.strategy}
            <select
              name="strategy"
              defaultValue={initial?.strategy ?? "reduce_payment"}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low focus:outline-none focus:border-primary"
            >
              <option value="reduce_payment">{labels.reducePayment}</option>
              <option value="shorten_term">{labels.shortenTerm}</option>
            </select>
          </label>
        </>
      ) : null}

      {eventType === "rate_change" ? (
        <>
          <label className="flex flex-col gap-1 text-label-md text-on-surface flex-1 min-w-[180px]">
            {labels.loan}
            <select
              name="loanId"
              value={selectedRateChangeLoan?.id ?? ""}
              onChange={(e) => setLoanId(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low focus:outline-none focus:border-primary"
            >
              {rateChangeLoans.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  {loan.name} ({loan.rateIndex})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label-md text-on-surface">
            {labels.newRatePercent}
            <input
              type="number"
              step="0.001"
              min="0"
              name="newAnnualValuePercent"
              defaultValue={initial?.newAnnualValuePercent ?? "3"}
              className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low w-32 focus:outline-none focus:border-primary"
            />
            <span className="text-label-sm text-on-surface-variant font-normal max-w-[220px]">{labels.newRatePercentHint}</span>
          </label>
        </>
      ) : null}

      <label className="flex flex-col gap-1 text-label-md text-on-surface">
        {labels.date}
        <input
          type="date"
          name="date"
          defaultValue={initial?.date ?? "2026-06-01"}
          className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low focus:outline-none focus:border-primary"
        />
      </label>

      {eventType === "income_change" || eventType === "expense_change" ? (
        <label className="flex flex-col gap-1 text-label-md text-on-surface">
          {labels.endDate}
          <input
            type="date"
            name="endDate"
            defaultValue={initial?.endDate ?? ""}
            className="border border-outline-variant rounded-lg px-3 py-3 text-body-md bg-surface-container-low focus:outline-none focus:border-primary"
          />
          <span className="text-label-sm text-on-surface-variant font-normal max-w-[220px]">{labels.endDateHint}</span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={
          (eventType === "one_time_expense" || eventType === "one_time_income") && accounts.length === 0
            ? true
            : eventType === "income_change" && incomes.length === 0
              ? true
              : eventType === "expense_change" && expenses.length === 0
                ? true
                : eventType === "prepayment" && loans.length === 0
                  ? true
                  : eventType === "rate_change" && rateChangeLoans.length === 0
        }
        className="bg-primary text-on-primary rounded-lg px-6 py-3 text-label-md font-medium hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {initial ? labels.save : labels.addEvent}
      </button>
      {initial && onCancelHref ? (
        <a
          href={onCancelHref}
          className="text-label-md text-on-surface-variant hover:text-on-surface px-4 py-3 transition-colors"
        >
          {labels.cancel}
        </a>
      ) : null}
    </form>
  );
}
