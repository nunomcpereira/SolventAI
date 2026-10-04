/** Shared projection point shape, used by both scenarioService and its consumers. */
export interface SimulationProjectionPoint {
  /** Cumulative period number since the simulation's very first period (period 1 = HORIZON_START's first month). */
  month: number;
  /** 1-12 position of this point within its displayed year window — resets every year so a
   * 12-month chart always reads Jan..Dec regardless of which year window is selected. */
  monthInYear: number;
  date: string;
  totalLiquidity: string;
  totalIncome: string;
  /** Per-recurring-income-item amount that occurred this period (excludes one-time income events). */
  incomeComponents: { itemId: string; accountId: string; amount: string }[];
  totalExpenses: string;
  /** Per-recurring-expense-item amount that occurred this period (excludes one-time expense events). */
  expenseComponents: { itemId: string; accountId: string; amount: string }[];
  totalDebtService: string;
  /** Per-loan payment and outstanding principal for this period. */
  debtComponents: { loanId: string; accountId: string; amount: string; outstanding: string }[];
  /** Sum of every loan's outstanding principal as of this period. */
  totalOutstandingDebt: string;
  /** Debt-service-weighted average effective annual loan rate for this period (%), if any loan is paying. */
  debtServiceRatePercent?: number;
  /** Effort rate / DTI for this specific period (totalDebtService / totalIncome × 100), if income was positive. */
  effortRatePercent?: string;
  /** Per-account balance as of this period, for both the base and selected scenario. */
  accountBalances: { accountId: string; balance: string }[];
}
