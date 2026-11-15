"use client";

import { useState, useTransition } from "react";

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

export interface TransferRowLabels {
  from: string;
  to: string;
  amount: string;
  frequency: string;
  startDate: string;
  endDate: string;
  description: string;
  ongoing: string;
  edit: string;
  save: string;
  cancel: string;
  delete: string;
  frequencies: Record<string, string>;
}

const FREQUENCIES = ["monthly", "quarterly", "semiannual", "annual", "biweekly", "weekly", "daily"] as const;
const inputClass = "border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm focus:outline-none focus:border-primary";

export function InlineTransferRow({
  id,
  fromAccountId,
  toAccountId,
  amount,
  formattedAmount,
  frequency,
  startDate,
  formattedStartDate,
  endDate,
  formattedEndDate,
  description,
  accounts,
  updateAction,
  deleteAction,
  labels,
}: {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  formattedAmount: string;
  frequency: string;
  startDate: string;
  formattedStartDate: string;
  endDate?: string;
  formattedEndDate?: string;
  description?: string;
  accounts: AccountOption[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  labels: TransferRowLabels;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const name = (accountId: string) => accounts.find((a) => a.id === accountId)?.name ?? accountId;

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
            <input type="hidden" name="transferId" value={id} />
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.from}
              <select name="fromAccountId" defaultValue={fromAccountId} className={inputClass}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.to}
              <select name="toAccountId" defaultValue={toAccountId} className={inputClass}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.amount}
              <input type="text" inputMode="decimal" name="amount" defaultValue={amount} required className={`${inputClass} w-28`} />
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.frequency}
              <select name="frequency" defaultValue={frequency} className={inputClass}>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{labels.frequencies[f] ?? f}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.startDate}
              <input type="date" name="startDate" defaultValue={startDate} required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.endDate}
              <input type="date" name="endDate" defaultValue={endDate ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.description}
              <input type="text" name="description" defaultValue={description ?? ""} className={`${inputClass} w-44`} />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="bg-primary text-on-primary rounded-lg px-3 py-1.5 text-label-sm font-medium disabled:opacity-60">
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
      <td className="py-2 pr-4 text-on-surface">
        {name(fromAccountId)} <span className="text-on-surface-variant">→</span> {name(toAccountId)}
        {description ? <span className="block text-label-sm text-on-surface-variant">{description}</span> : null}
      </td>
      <td className="py-2 pr-4 text-on-surface">{formattedAmount}</td>
      <td className="py-2 pr-4 text-on-surface-variant">{labels.frequencies[frequency] ?? frequency}</td>
      <td className="py-2 pr-4 text-on-surface-variant">{formattedStartDate}</td>
      <td className="py-2 pr-4 text-on-surface-variant">{formattedEndDate ?? labels.ongoing}</td>
      <td className="py-2 pr-4 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            aria-label={labels.edit}
            title={labels.edit}
            onClick={() => setIsEditing(true)}
            className="w-8 h-8 rounded-sm border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary hover:bg-surface-container-low transition-colors inline-flex items-center justify-center"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
          </button>
          <form action={deleteAction}>
            <input type="hidden" name="transferId" value={id} />
            <button
              type="submit"
              aria-label={labels.delete}
              title={labels.delete}
              className="w-8 h-8 rounded-sm border border-outline-variant text-on-surface-variant hover:text-status-danger hover:border-status-danger hover:bg-surface-container-low transition-colors inline-flex items-center justify-center"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
