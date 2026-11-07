"use client";

import { useEffect, useState } from "react";
import { InlineEditForm, InlineEditTrigger } from "./InlineEditControls.js";

interface InlineAccountBalanceEditorProps {
  accountId: string;
  balance: string;
  minimumReserve: string;
  active: boolean;
  formattedBalance: string;
  formattedBalanceSecondary?: string;
  warning: boolean;
  updateAction: (formData: FormData) => Promise<void>;
  labels: { edit: string; save: string; cancel: string };
}

export function InlineAccountBalanceEditor({
  accountId,
  balance,
  minimumReserve,
  active,
  formattedBalance,
  formattedBalanceSecondary,
  warning,
  updateAction,
  labels,
}: InlineAccountBalanceEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(balance);

  useEffect(() => {
    setValue(balance);
  }, [balance]);

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <div>
          <p className={`text-headline-md ${warning ? "text-status-danger" : "text-on-surface"}`}>
            {formattedBalance}
          </p>
          {formattedBalanceSecondary ? (
            <p className="text-label-sm text-on-surface-variant">{formattedBalanceSecondary}</p>
          ) : null}
        </div>
        <InlineEditTrigger label={labels.edit} onClick={() => setIsEditing(true)} />
      </div>
    );
  }

  return (
    <InlineEditForm
      hiddenFields={{ accountId, minimumReserve, active: active ? "on" : "" }}
      saveLabel={labels.save}
      cancelLabel={labels.cancel}
      action={updateAction}
      onSaved={() => setIsEditing(false)}
      onCancel={() => {
        setValue(balance);
        setIsEditing(false);
      }}
    >
      <input
        type="number"
        step="0.01"
        name="balance"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-36 border border-outline-variant rounded-lg px-2 py-1 text-body-sm focus:outline-none focus:border-primary"
      />
    </InlineEditForm>
  );
}
