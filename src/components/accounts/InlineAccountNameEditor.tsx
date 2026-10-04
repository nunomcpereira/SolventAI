"use client";

import { useEffect, useState } from "react";
import { InlineEditForm, InlineEditTrigger } from "./InlineEditControls.js";

interface InlineAccountNameEditorProps {
  accountId: string;
  name: string;
  renameAction: (formData: FormData) => Promise<void>;
}

export function InlineAccountNameEditor({ accountId, name, renameAction }: InlineAccountNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(name);

  useEffect(() => {
    setValue(name);
  }, [name]);

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <h3 className="text-headline-sm text-on-surface">{name}</h3>
        <InlineEditTrigger label={`Rename ${name}`} onClick={() => setIsEditing(true)} />
      </div>
    );
  }

  return (
    <InlineEditForm
      hiddenFields={{ accountId }}
      saveLabel="Save account name"
      cancelLabel="Cancel rename"
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
