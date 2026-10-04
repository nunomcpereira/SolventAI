import { type AccountType } from "../../domain/accounts/account.js";
import { type Loan, DEFAULT_LOAN_CATEGORIES } from "../../domain/loans/loan.js";
import { INCOME_CATEGORIES } from "../../domain/income/income.js";
import { type Settings } from "../../domain/settings/settings.js";

export const ACCOUNT_TYPE_ORDER: AccountType[] = ["checking", "savings", "emergency", "investment", "other"];
export const LOAN_CATEGORY_ORDER: string[] = [...DEFAULT_LOAN_CATEGORIES];

export interface TypeOption<T extends string> {
  value: T;
  label: string;
}

export function getAccountTypeOptions(settings: Settings): TypeOption<AccountType>[] {
  return ACCOUNT_TYPE_ORDER.map((value) => ({ value, label: settings.accountTypeLabels[value] }));
}

export function getLoanCategoryOptions(settings: Settings): TypeOption<Loan["category"]>[] {
  const values = [...LOAN_CATEGORY_ORDER, ...settings.customLoanCategories];
  return values.map((value) => ({ value, label: settings.loanCategoryLabels[value] ?? value }));
}

export function getIncomeCategoryOptions(settings: Settings): TypeOption<string>[] {
  const values = [...INCOME_CATEGORIES, ...settings.customIncomeCategories];
  return values.map((value) => ({ value, label: value }));
}
