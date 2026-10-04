"use client";

import { useFormStatus } from "react-dom";

export function UploadSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-on-primary py-3 px-6 rounded-lg text-label-md font-medium shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
