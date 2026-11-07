"use client";

import { useState } from "react";

interface CustomTypeListEditorProps {
  name: string;
  initialValues: string[];
  addLabel: string;
  emptyLabel: string;
  placeholder: string;
}

export function CustomTypeListEditor({
  name,
  initialValues,
  addLabel,
  emptyLabel,
  placeholder,
}: CustomTypeListEditorProps) {
  const [values, setValues] = useState<string[]>(initialValues);

  return (
    <div className="flex flex-col gap-2">
      {values.length === 0 ? <p className="text-label-sm text-on-surface-variant">{emptyLabel}</p> : null}
      {values.map((value, index) => (
        <div key={`${name}-${index}`} className="flex items-center gap-2">
          <input
            name={name}
            value={value}
            onChange={(event) => {
              const next = [...values];
              next[index] = event.target.value;
              setValues(next);
            }}
            className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => setValues(values.filter((_, current) => current !== index))}
            className="w-9 h-9 rounded-sm border border-outline-variant text-on-surface-variant hover:text-status-danger hover:border-status-danger hover:bg-surface-container-low transition-colors flex items-center justify-center"
            aria-label="Delete custom type"
            title="Delete custom type"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              delete
            </span>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setValues([...values, ""])}
        className="self-start text-label-md text-primary hover:underline flex items-center gap-1"
      >
        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
          add
        </span>
        {addLabel}
      </button>
    </div>
  );
}
