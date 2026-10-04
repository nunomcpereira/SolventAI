"use client";

import { useState, useTransition } from "react";

interface InlineAccountActiveEditorProps {
  accountId: string;
  balance: string;
  minimumReserve: string;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  updateAction: (formData: FormData) => Promise<void>;
}

export function InlineAccountActiveEditor({
  accountId,
  balance,
  minimumReserve,
  active,
  activeLabel,
  inactiveLabel,
  updateAction,
}: InlineAccountActiveEditorProps) {
  const [value, setValue] = useState(active);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = !value;
    setValue(next);
    const formData = new FormData();
    formData.set("accountId", accountId);
    formData.set("balance", balance);
    formData.set("minimumReserve", minimumReserve);
    if (next) formData.set("active", "on");
    startTransition(async () => {
      await updateAction(formData);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={value ? activeLabel : inactiveLabel}
        title={value ? activeLabel : inactiveLabel}
        onClick={toggle}
        disabled={isPending}
        className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-60 ${value ? "bg-primary" : "bg-outline-variant"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
      <span className="text-body-md text-on-surface">{value ? activeLabel : inactiveLabel}</span>
    </div>
  );
}
