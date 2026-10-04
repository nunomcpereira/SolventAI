"use client";

import { useEffect, useState } from "react";
import { InlineEditForm, InlineEditTrigger } from "./InlineEditControls.js";

interface InlineAccountReserveEditorProps {
  accountId: string;
  balance: string;
  minimumReserve: string;
  active: boolean;
  formattedReserve: string;
  formattedReserveSecondary?: string;
  updateAction: (formData: FormData) => Promise<void>;
}

export function InlineAccountReserveEditor({
  accountId,
  balance,
  minimumReserve,
  active,
  formattedReserve,
  formattedReserveSecondary,
  updateAction,
}: InlineAccountReserveEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(minimumReserve);

  useEffect(() => {
    setValue(minimumReserve);
  }, [minimumReserve]);

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <div>
          <p className="text-body-md text-on-surface">{formattedReserve}</p>
          {formattedReserveSecondary ? (
            <p className="text-label-sm text-on-surface-variant">{formattedReserveSecondary}</p>
          ) : null}
        </div>
        <InlineEditTrigger label="Edit minimum reserve" onClick={() => setIsEditing(true)} />
      </div>
    );
  }

  return (
    <InlineEditForm
      hiddenFields={{ accountId, balance, active: active ? "on" : "" }}
      saveLabel="Save minimum reserve"
      cancelLabel="Cancel minimum reserve edit"
      action={updateAction}
      onSaved={() => setIsEditing(false)}
      onCancel={() => {
        setValue(minimumReserve);
        setIsEditing(false);
      }}
    >
      <input
        type="number"
        step="0.01"
        name="minimumReserve"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-36 border border-outline-variant rounded-lg px-2 py-1 text-body-sm focus:outline-none focus:border-primary"
      />
    </InlineEditForm>
  );
}
