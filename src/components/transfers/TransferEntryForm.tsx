interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

export interface TransferEntryFormLabels {
  from: string;
  to: string;
  amount: string;
  frequency: string;
  startDate: string;
  description: string;
  save: string;
  frequencies: Record<string, string>;
}

const FREQUENCIES = ["monthly", "quarterly", "semiannual", "annual", "biweekly", "weekly", "daily"] as const;
const inputClass = "border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary";

/** "New recurring transfer" form — plain server-rendered form, no client state needed. */
export function TransferEntryForm({
  action,
  accounts,
  defaultFromId,
  defaultToId,
  today,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  accounts: AccountOption[];
  defaultFromId?: string;
  defaultToId?: string;
  today: string;
  labels: TransferEntryFormLabels;
}) {
  return (
    <form action={action} className="flex flex-col gap-stack-sm mt-stack-md text-left w-full max-w-xs mx-auto">
      <label className="flex flex-col gap-1 eyebrow">
        {labels.from}
        <select name="fromAccountId" required defaultValue={defaultFromId} className={inputClass}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 eyebrow">
        {labels.to}
        <select name="toAccountId" required defaultValue={defaultToId} className={inputClass}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 eyebrow">
        {labels.amount}
        <input type="text" inputMode="decimal" name="amount" required defaultValue="100" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 eyebrow">
        {labels.frequency}
        <select name="frequency" defaultValue="monthly" className={inputClass}>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>{labels.frequencies[f] ?? f}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 eyebrow">
        {labels.startDate}
        <input type="date" name="startDate" required defaultValue={today} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 eyebrow">
        {labels.description}
        <input type="text" name="description" className={inputClass} />
      </label>
      <button type="submit" className="bg-primary text-on-primary py-2 rounded-lg text-label-md mt-stack-sm">
        {labels.save}
      </button>
    </form>
  );
}
