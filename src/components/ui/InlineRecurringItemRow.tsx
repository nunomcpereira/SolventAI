"use client";

import { useState, useTransition } from "react";

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface InlineRecurringItemRowLabels {
  account: string;
  amount: string;
  frequency: string;
  category: string;
  startDate: string;
  endDate: string;
  ongoing: string;
  edit: string;
  save: string;
  cancel: string;
  delete: string;
  freqMonthly: string;
  freqQuarterly: string;
  freqSemiannual: string;
  freqAnnual: string;
  freqBiweekly: string;
  freqWeekly: string;
  freqDaily: string;
}

export function InlineRecurringItemRow({
  id,
  idFieldName,
  accountId,
  accountName,
  amount,
  formattedAmount,
  currency,
  frequency,
  frequencyLabel,
  category,
  categoryLabel,
  startDate,
  endDate,
  accounts,
  categoryOptions,
  updateAction,
  deleteAction,
  labels,
}: {
  id: string;
  idFieldName: "incomeId" | "expenseId";
  accountId: string;
  accountName: string;
  amount: string;
  formattedAmount: string;
  currency: string;
  frequency: string;
  frequencyLabel: string;
  category: string;
  categoryLabel: string;
  startDate: string;
  endDate?: string;
  accounts: AccountOption[];
  categoryOptions: CategoryOption[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  labels: InlineRecurringItemRowLabels;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isEditing) {
    return (
      <tr className="border-b border-outline-variant last:border-0">
        <td colSpan={7} className="py-3">
          <form
            className="flex flex-wrap items-end gap-stack-sm"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                await updateAction(formData);
                setIsEditing(false);
              });
            }}
          >
            <input type="hidden" name={idFieldName} value={id} />
            <input type="hidden" name="currency" value={currency} />

            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.account}
              <select
                name="accountId"
                defaultValue={accountId}
                className="border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm focus:outline-none focus:border-primary"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
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
                defaultValue={amount}
                required
                className="border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm w-28 focus:outline-none focus:border-primary"
              />
            </label>

            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.frequency}
              <select
                name="frequency"
                defaultValue={frequency}
                className="border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm focus:outline-none focus:border-primary"
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

            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.category}
              <select
                name="category"
                defaultValue={category}
                className="border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm focus:outline-none focus:border-primary"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.startDate}
              <input
                type="date"
                name="startDate"
                defaultValue={startDate}
                required
                className="border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm focus:outline-none focus:border-primary"
              />
            </label>

            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.endDate}
              <input
                type="date"
                name="endDate"
                defaultValue={endDate ?? ""}
                className="border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm focus:outline-none focus:border-primary"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary text-on-primary rounded-lg px-3 py-1.5 text-label-sm font-medium disabled:opacity-60"
              >
                {labels.save}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isPending}
                className="border border-outline-variant rounded-lg px-3 py-1.5 text-label-sm text-on-surface-variant disabled:opacity-60"
              >
                {labels.cancel}
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-outline-variant last:border-0">
      <td className="py-2 pr-4 text-on-surface">{accountName}</td>
      <td className="py-2 pr-4 text-on-surface">{formattedAmount}</td>
      <td className="py-2 pr-4 text-on-surface-variant">{frequencyLabel}</td>
      <td className="py-2 pr-4 text-on-surface-variant capitalize">{categoryLabel.replace("_", " ")}</td>
      <td className="py-2 pr-4 text-on-surface-variant">{startDate}</td>
      <td className="py-2 pr-4 text-on-surface-variant">{endDate ?? labels.ongoing}</td>
      <td className="py-2 pr-4 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            aria-label={labels.edit}
            title={labels.edit}
            onClick={() => setIsEditing(true)}
            className="w-8 h-8 rounded-full border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary hover:bg-surface-container-low transition-colors inline-flex items-center justify-center"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              edit
            </span>
          </button>
          <form action={deleteAction}>
            <input type="hidden" name={idFieldName} value={id} />
            <button
              type="submit"
              aria-label={labels.delete}
              title={labels.delete}
              className="w-8 h-8 rounded-full border border-outline-variant text-on-surface-variant hover:text-status-danger hover:border-status-danger hover:bg-surface-container-low transition-colors inline-flex items-center justify-center"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                delete
              </span>
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
