import "server-only";
import { type Database } from "../db/client.js";
import {
  createSqliteAccountRepository,
  createSqliteLoanRepository,
  createSqliteIncomeRepository,
  createSqliteExpenseRepository,
  createSqliteSettingsRepository,
  createSqliteScenarioRepository,
} from "../db/repositories/index.js";
import { parseAccount } from "../../domain/accounts/account.js";
import { parseLoan } from "../../domain/loans/loan.js";
import { parseIncome } from "../../domain/income/income.js";
import { parseExpense } from "../../domain/expenses/expense.js";
import { parseScenario } from "../../domain/scenarios/scenario.js";
import { DEFAULT_SETTINGS } from "../../domain/settings/settings.js";

/**
 * Seeds a handful of demo records only on true first run, so the dashboard has real
 * (if illustrative) data out of the box. If the user later deletes all accounts,
 * we must preserve that empty state and never resurrect defaults.
 */
export async function ensureSeeded(db: Database): Promise<void> {
  const accountRepo = createSqliteAccountRepository(db);
  const loanRepo = createSqliteLoanRepository(db);
  const incomeRepo = createSqliteIncomeRepository(db);
  const expenseRepo = createSqliteExpenseRepository(db);
  const settingsRepo = createSqliteSettingsRepository(db);

  const existingSettings = await settingsRepo.get();
  if (existingSettings) return;

  const [accounts, loans, incomes, expenses] = await Promise.all([
    accountRepo.list(),
    loanRepo.list(),
    incomeRepo.list(),
    expenseRepo.list(),
  ]);

  // Existing data without settings means the DB was already initialized; only
  // backfill settings and do not inject demo records.
  if (accounts.length > 0 || loans.length > 0 || incomes.length > 0 || expenses.length > 0) {
    await settingsRepo.save(DEFAULT_SETTINGS);
    return;
  }

  await settingsRepo.save(DEFAULT_SETTINGS);

  await accountRepo.save(
    parseAccount({
      id: "acc-checking",
      name: "Main Checking",
      type: "checking",
      currency: "EUR",
      initialBalance: { minorUnits: "800000", currency: "EUR" },
      minimumReserve: { minorUnits: "100000", currency: "EUR" },
      active: true,
    }),
  );
  await accountRepo.save(
    parseAccount({
      id: "acc-savings",
      name: "Emergency Savings",
      type: "emergency",
      currency: "EUR",
      initialBalance: { minorUnits: "1500000", currency: "EUR" },
      minimumReserve: { minorUnits: "1000000", currency: "EUR" },
      active: true,
    }),
  );

  await loanRepo.save(
    parseLoan({
      id: "loan-mortgage",
      name: "Home Mortgage",
      category: "mortgage",
      principal: { minorUnits: "25000000", currency: "EUR" },
      startDate: "2024-01-01",
      numberOfPeriods: 360,
      paymentFrequency: "monthly",
      amortizationType: "french",
      dayCountConvention: "actual/365",
      rate: { type: "fixed", annualRate: "0.035" },
      sourceAccountId: "acc-checking",
      fees: [],
      prepaymentPenalty: { type: "percentage", rate: "0.005", maximumPenalty: { minorUnits: "200000", currency: "EUR" } },
    }),
  );
  await loanRepo.save(
    parseLoan({
      id: "loan-auto",
      name: "Car Loan",
      category: "auto",
      principal: { minorUnits: "2500000", currency: "EUR" },
      startDate: "2025-06-01",
      numberOfPeriods: 60,
      paymentFrequency: "monthly",
      amortizationType: "constant_amortization",
      dayCountConvention: "30/360",
      rate: { type: "fixed", annualRate: "0.059" },
      sourceAccountId: "acc-checking",
      fees: [],
      prepaymentPenalty: { type: "none" },
    }),
  );

  await incomeRepo.save(
    parseIncome({
      id: "inc-salary",
      accountId: "acc-checking",
      amount: { minorUnits: "420000", currency: "EUR" },
      frequency: "monthly",
      startDate: "2026-01-01",
      category: "salary",
    }),
  );

  await expenseRepo.save(
    parseExpense({
      id: "exp-living",
      accountId: "acc-checking",
      amount: { minorUnits: "150000", currency: "EUR" },
      frequency: "monthly",
      startDate: "2026-01-01",
      category: "discretionary",
    }),
  );

  const scenarioRepo = createSqliteScenarioRepository(db);
  await scenarioRepo.save(
    parseScenario({
      id: "scenario-job-loss",
      name: "Job loss",
      events: [
        {
          id: "scenario-job-loss-ev1",
          date: "2026-07-01",
          payload: { type: "income_change", incomeId: "inc-salary", newAmount: { minorUnits: "0", currency: "EUR" } },
        },
      ],
    }),
  );
  await scenarioRepo.save(
    parseScenario({
      id: "scenario-raise",
      name: "Salary raise",
      events: [
        {
          id: "scenario-raise-ev1",
          date: "2026-09-01",
          payload: { type: "income_change", incomeId: "inc-salary", newAmount: { minorUnits: "480000", currency: "EUR" } },
        },
      ],
    }),
  );
  await scenarioRepo.save(
    parseScenario({
      id: "scenario-extra-payment",
      name: "Extra mortgage payment",
      events: [
        {
          id: "scenario-extra-payment-ev1",
          date: "2026-05-01",
          payload: {
            type: "prepayment",
            loanId: "loan-mortgage",
            sourceAccountId: "acc-checking",
            amount: { minorUnits: "1000000", currency: "EUR" },
            strategy: "reduce_payment",
          },
        },
      ],
    }),
  );
}
