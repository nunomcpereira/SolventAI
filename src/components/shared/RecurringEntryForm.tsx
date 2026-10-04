"use client";

import { useMemo, useState } from "react";

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface RecurringEntryFormLabels {
  sourceAccount: string;
  amount: string;
  frequency: string;
  category: string;
  startDate: string;
  save: string;
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

type EntryType = "recurring" | "one_off";

/** Shared shape behind the "new income entry" and "new expense entry" forms — same
 * fields and behavior, only labels/categories/default amount differ per caller. */
export function RecurringEntryForm({
  action,
  accounts,
  categoryOptions,
  defaultCategory,
  defaultAmount,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  accounts: AccountOption[];
  categoryOptions: CategoryOption[];
  defaultCategory: string;
  defaultAmount: string;
  labels: RecurringEntryFormLabels;
}) {
  const [entryType, setEntryType] = useState<EntryType>("recurring");
  const defaultDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <form action={action} className="flex flex-col gap-stack-sm mt-stack-md text-left w-full max-w-xs mx-auto">
      <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
        {labels.sourceAccount}
        <select
          name="accountId"
          required
          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
        {labels.amount}
        <input
          type="text"
          inputMode="decimal"
          name="amount"
          defaultValue={defaultAmount}
          required
          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
        {labels.schedule}
        <select
          name="entryType"
          value={entryType}
          onChange={(event) => setEntryType(event.target.value as EntryType)}
          required
          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
        >
          <option value="recurring">{labels.scheduleRecurring}</option>
          <option value="one_off">{labels.scheduleOneOff}</option>
        </select>
      </label>

      {entryType === "recurring" ? (
        <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
          {labels.frequency}
          <select
            name="frequency"
            defaultValue="monthly"
            className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
          >
            <option value="monthly">{labels.freqMonthly}</option>
            <option value="quarterly">{labels.freqQuarterly}</option>
            <option value="semiannual">{labels.freqSemiannual}</option>
            <option value="annual">{labels.freqAnnual}</option>
            <option value="biweekly">{labels.freqBiweekly}</option>
            <option value="weekly">{labels.freqWeekly}</option>
            <option value="daily">{labels.freqDaily}</option>
          </select>
        </label>
      ) : null}

      {entryType !== "recurring" ? <input type="hidden" name="frequency" value="monthly" /> : null}

      <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
        {labels.category}
        <select
          name="category"
          defaultValue={defaultCategory}
          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
        >
          {categoryOptions.map((categoryOption) => (
            <option key={categoryOption.value} value={categoryOption.value}>
              {categoryOption.label.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
        {labels.startDate}
        <input
          type="date"
          name="startDate"
          defaultValue={defaultDate}
          required
          className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
        />
      </label>

      <button
        type="submit"
        disabled={accounts.length === 0}
        className="bg-primary text-on-primary py-2 rounded-lg text-label-md mt-stack-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {labels.save}
      </button>
    </form>
  );
}
