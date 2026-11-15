import "server-only";
import { appTodayIso } from "./db.js";
import { getSettings } from "./settingsService.js";
import { listRecurringExpenses, listRecurringIncomes } from "./recurringItemsService.js";
import { listLoanSummaries } from "./loansPageService.js";
import { convertMoneyToCurrency } from "./exchangeRateService.js";
import { Money } from "../../engine/money/money.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { computeExpenseAllocation, type ExpenseAllocation } from "../../engine/metrics/expenseAllocation.js";

export interface ExpenseStats {
  currency: string;
  /** Recurring expenses, as an average month, by category. */
  allocation: ExpenseAllocation;
  /** Current loan instalments per month. */
  monthlyLoanPayments: Money;
  /** Recurring income as an average month. */
  monthlyIncome: Money;
}

/** Everything the "recurring expenses" overview needs, in the base currency, as of today. */
export async function getExpenseStats(): Promise<ExpenseStats> {
  const [settings, today, expenses, incomes, loans] = await Promise.all([
    getSettings(),
    appTodayIso(),
    listRecurringExpenses(),
    listRecurringIncomes(),
    listLoanSummaries(),
  ]);
  const currency = settings.baseCurrency;
  const asOf = IsoDate.fromString(today);
  const inBase = <T extends { amount: Money }>(items: readonly T[]) =>
    Promise.all(items.map(async (i) => ({ ...i, amount: await convertMoneyToCurrency(i.amount, currency) })));

  const allocation = computeExpenseAllocation(await inBase(expenses), currency, asOf);
  const monthlyIncome = computeExpenseAllocation(await inBase(incomes), currency, asOf).totalMonthly;
  const payments = await Promise.all(
    loans.flatMap((l) => (l.monthlyPayment ? [convertMoneyToCurrency(l.monthlyPayment, currency)] : [])),
  );
  const monthlyLoanPayments = payments.reduce((acc, p) => acc.add(p), Money.zero(currency));
  return { currency, allocation, monthlyLoanPayments, monthlyIncome };
}
