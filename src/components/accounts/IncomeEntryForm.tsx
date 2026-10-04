"use client";

import { RecurringEntryForm } from "../shared/RecurringEntryForm.js";

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface IncomeEntryFormLabels {
  sourceAccount: string;
  incomeAmount: string;
  incomeFrequency: string;
  incomeCategory: string;
  incomeStartDate: string;
  saveIncome: string;
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

interface IncomeEntryFormProps {
  action: (formData: FormData) => Promise<void>;
  accounts: AccountOption[];
  categoryOptions: CategoryOption[];
  labels: IncomeEntryFormLabels;
}

export function IncomeEntryForm({ action, accounts, categoryOptions, labels }: IncomeEntryFormProps) {
  return (
    <RecurringEntryForm
      action={action}
      accounts={accounts}
      categoryOptions={categoryOptions}
      defaultCategory="salary"
      defaultAmount="1000"
      labels={{
        sourceAccount: labels.sourceAccount,
        amount: labels.incomeAmount,
        frequency: labels.incomeFrequency,
        category: labels.incomeCategory,
        startDate: labels.incomeStartDate,
        save: labels.saveIncome,
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
