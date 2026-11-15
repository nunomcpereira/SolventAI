"use client";

import { useState } from "react";

export interface ProposalRowData {
  index: number;
  key: string;
  kind: "expense" | "income" | "transfer";
  /** Debits may be an expense or a transfer; credits are always income. */
  credit: boolean;
  title: string;
  subtitle?: string;
  amount: string;
  frequency: string;
  category: string;
  startDate: string;
  toAccountId?: string;
  updateId?: string;
  defaultChecked: boolean;
  /** Already registered / covered by a loan: shown for reference, not selectable. */
  locked: boolean;
  badges: { tone: "healthy" | "warning" | "danger" | "neutral"; text: string }[];
  evidence: { date: string; amount: string; description: string }[];
  evidenceMore: number;
  topCounterparties?: { label: string; total: string }[];
}

export interface ProposalRowLabels {
  include: string;
  kind: string;
  kinds: Record<"expense" | "income" | "transfer", string>;
  amount: string;
  frequency: string;
  frequencies: Record<string, string>;
  category: string;
  target: string;
  chooseAccount: string;
  startDate: string;
  evidence: string;
  evidenceMore: string;
  topCounterparties: string;
  dismiss: string;
}

const FREQUENCIES = ["monthly", "quarterly", "semiannual", "annual", "biweekly", "weekly"] as const;
const inputClass =
  "border border-outline-variant rounded-lg px-2 py-1.5 text-body-sm bg-surface text-on-surface focus:outline-none focus:border-primary disabled:opacity-60";

const toneClass: Record<ProposalRowData["badges"][number]["tone"], string> = {
  healthy: "text-status-healthy border-status-healthy/50",
  warning: "text-status-warning border-status-warning/50",
  danger: "text-status-danger border-status-danger/50",
  neutral: "text-on-surface-variant border-outline-variant",
};

export function ProposalRow({
  row,
  accounts,
  expenseCategories,
  incomeCategories,
  labels,
  dismissAction,
}: {
  row: ProposalRowData;
  accounts: { id: string; name: string }[];
  expenseCategories: { value: string; label: string }[];
  incomeCategories: { value: string; label: string }[];
  labels: ProposalRowLabels;
  dismissAction: (formData: FormData) => Promise<void>;
}) {
  const [kind, setKind] = useState(row.kind);
  const [checked, setChecked] = useState(row.defaultChecked);
  const p = (name: string) => `p${row.index}_${name}`;
  const disabled = row.locked || !checked;
  const categories = kind === "income" ? incomeCategories : expenseCategories;
  const categoryValue = categories.some((c) => c.value === row.category) ? row.category : "other";

  return (
    <li className={`py-4 flex flex-col gap-3 ${row.locked ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          name="pick"
          value={row.index}
          aria-label={`${labels.include}: ${row.title}`}
          checked={checked && !row.locked}
          disabled={row.locked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-1 w-4 h-4 accent-primary"
        />
        <input type="hidden" name={p("key")} value={row.key} />
        {row.updateId ? <input type="hidden" name={p("updateId")} value={row.updateId} /> : null}
        <input type="hidden" name={p("description")} value={kind === "transfer" ? row.title : ""} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-label-md text-on-surface font-semibold break-words">{row.title}</span>
            {row.badges.map((badge) => (
              <span
                key={badge.text}
                className={`inline-flex items-center px-1.5 py-[1px] rounded-sm border text-[12px] leading-[18px] font-medium ${toneClass[badge.tone]}`}
              >
                {badge.text}
              </span>
            ))}
          </div>
          {row.subtitle ? <p className="text-label-sm text-on-surface-variant mt-0.5">{row.subtitle}</p> : null}
        </div>
        {!row.locked ? (
          <button
            type="submit"
            // A button with a function formAction can't carry name/value (React overrides
            // them), so the key is added to the submitted data here.
            formAction={(formData: FormData) => {
              formData.set("dismissKey", row.key);
              return dismissAction(formData);
            }}
            formNoValidate
            className="shrink-0 text-label-sm text-on-surface-variant hover:text-status-danger border border-outline-variant hover:border-status-danger rounded-sm px-2 py-1"
          >
            {labels.dismiss}
          </button>
        ) : null}
      </div>

      {!row.locked ? (
        <div className="flex flex-wrap items-end gap-stack-sm pl-7">
          {row.credit ? (
            <input type="hidden" name={p("kind")} value="income" />
          ) : (
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.kind}
              <select name={p("kind")} value={kind} disabled={disabled} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputClass}>
                <option value="expense">{labels.kinds.expense}</option>
                <option value="transfer">{labels.kinds.transfer}</option>
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.amount}
            <input type="text" inputMode="decimal" name={p("amount")} defaultValue={row.amount} disabled={disabled} required className={`${inputClass} w-28`} />
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.frequency}
            <select name={p("frequency")} defaultValue={row.frequency} disabled={disabled} className={inputClass}>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {labels.frequencies[f] ?? f}
                </option>
              ))}
            </select>
          </label>
          {kind === "transfer" ? (
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.target}
              <select name={p("toAccountId")} defaultValue={row.toAccountId ?? ""} disabled={disabled} required className={inputClass}>
                <option value="">{labels.chooseAccount}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.category}
              <select key={kind} name={p("category")} defaultValue={categoryValue} disabled={disabled} className={inputClass}>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.startDate}
            <input type="date" name={p("startDate")} defaultValue={row.startDate} disabled={disabled} required className={inputClass} />
          </label>
        </div>
      ) : null}

      <details className="pl-7 text-label-sm text-on-surface-variant">
        <summary className="cursor-pointer select-none hover:text-on-surface">{labels.evidence}</summary>
        {row.topCounterparties && row.topCounterparties.length > 0 ? (
          <div className="mt-2">
            <p className="eyebrow mb-1">{labels.topCounterparties}</p>
            <ul className="grid grid-cols-[1fr_auto] gap-x-4 max-w-md">
              {row.topCounterparties.map((c) => (
                <li key={c.label} className="contents">
                  <span className="truncate">{c.label}</span>
                  <span className="font-mono text-right">{c.total}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <ul className="mt-2 grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-0.5 max-w-xl">
          {row.evidence.map((e, i) => (
            <li key={`${e.date}-${i}`} className="contents">
              <span className="font-mono">{e.date}</span>
              <span className="font-mono text-right">{e.amount}</span>
              <span className="truncate">{e.description}</span>
            </li>
          ))}
        </ul>
        {row.evidenceMore > 0 ? <p className="mt-1">{labels.evidenceMore.replace("{count}", String(row.evidenceMore))}</p> : null}
      </details>
    </li>
  );
}
