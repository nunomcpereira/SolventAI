"use client";

import { RecurringEntryForm } from "../shared/RecurringEntryForm.js";

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

interface ExpenseEntryFormLabels {
  sourceAccount: string;
  expenseAmount: string;
  expenseFrequency: string;
  expenseCategory: string;
  expenseStartDate: string;
  saveExpense: string;
  schedule: string;
  scheduleRecurring: string;
  scheduleOneOff: string;
  freqMonthly: string;
  freqQuarterly: string;
  freqSemiannual: string;
  freqAnnual: string;
  freqBiweekly: string;
  freqWeekly: string;
  freqDaily: string;
}

interface ExpenseEntryFormProps {
  action: (formData: FormData) => Promise<void>;
  accounts: AccountOption[];
  categories: readonly string[];
  labels: ExpenseEntryFormLabels;
}

export function ExpenseEntryForm({ action, accounts, categories, labels }: ExpenseEntryFormProps) {
  return (
    <RecurringEntryForm
      action={action}
      accounts={accounts}
      categoryOptions={categories.map((category) => ({ value: category, label: category }))}
      defaultCategory="housing"
      defaultAmount="500"
      labels={{
        sourceAccount: labels.sourceAccount,
        amount: labels.expenseAmount,
        frequency: labels.expenseFrequency,
        category: labels.expenseCategory,
        startDate: labels.expenseStartDate,
        save: labels.saveExpense,
        schedule: labels.schedule,
        scheduleRecurring: labels.scheduleRecurring,
        scheduleOneOff: labels.scheduleOneOff,
        freqMonthly: labels.freqMonthly,
        freqQuarterly: labels.freqQuarterly,
        freqSemiannual: labels.freqSemiannual,
        freqAnnual: labels.freqAnnual,
        freqBiweekly: labels.freqBiweekly,
        freqWeekly: labels.freqWeekly,
        freqDaily: labels.freqDaily,
      }}
    />
  );
}
