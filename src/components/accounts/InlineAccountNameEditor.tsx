"use client";

import { useEffect, useState } from "react";
import { InlineEditForm, InlineEditTrigger } from "./InlineEditControls.js";

interface InlineAccountNameEditorProps {
  accountId: string;
  name: string;
  renameAction: (formData: FormData) => Promise<void>;
  /** `edit` may contain "{name}". */
  labels: { edit: string; save: string; cancel: string };
}

export function InlineAccountNameEditor({ accountId, name, renameAction, labels }: InlineAccountNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(name);

  useEffect(() => {
    setValue(name);
  }, [name]);

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <h3 className="text-headline-sm text-on-surface">{name}</h3>
        <InlineEditTrigger label={labels.edit.replace("{name}", name)} onClick={() => setIsEditing(true)} />
      </div>
    );
  }

  return (
    <InlineEditForm
      hiddenFields={{ accountId }}
      saveLabel={labels.save}
      cancelLabel={labels.cancel}
      action={renameAction}
      onSaved={() => setIsEditing(false)}
      onCancel={() => {
        setValue(name);
        setIsEditing(false);
      }}
    >
      <input
        type="text"
        name="name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
        className="border border-outline-variant rounded-lg px-2 py-1 text-body-sm focus:outline-none focus:border-primary"
      />
    </InlineEditForm>
  );
}
