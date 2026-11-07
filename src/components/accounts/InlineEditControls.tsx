"use client";

import { useTransition, type ReactNode } from "react";

const iconButtonClass =
  "w-7 h-7 rounded-sm border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary hover:bg-surface-container-low transition-colors flex items-center justify-center";

export function InlineEditTrigger({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={iconButtonClass}>
      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
        edit
      </span>
    </button>
  );
}

interface InlineEditFormProps {
  hiddenFields: Record<string, string>;
  saveLabel: string;
  cancelLabel: string;
  action: (formData: FormData) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
  children: ReactNode;
}

/** Shared form chrome (hidden fields + input + save/cancel) behind the accounts page's inline editors. */
export function InlineEditForm({ hiddenFields, saveLabel, cancelLabel, action, onSaved, onCancel, children }: InlineEditFormProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          await action(formData);
          onSaved();
        });
      }}
    >
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <button type="submit" aria-label={saveLabel} title={saveLabel} disabled={isPending} className={`${iconButtonClass} disabled:opacity-60`}>
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
          check
        </span>
      </button>
      <button type="button" aria-label={cancelLabel} title={cancelLabel} onClick={onCancel} disabled={isPending} className={`${iconButtonClass} disabled:opacity-60`}>
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
          close
        </span>
      </button>
    </form>
  );
}
