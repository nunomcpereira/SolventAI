"use client";

import { useRef, useState, type DragEvent } from "react";

export interface FileDropZoneLabels {
  /** Main line, e.g. "Choose the statement file". */
  title: string;
  /** Shown under the title while nothing is chosen, e.g. "or drag it here". */
  hint: string;
  /** Shown while a file is dragged over the zone. */
  dropHere: string;
  /** "{name}" is replaced by the chosen file's name. */
  selected: string;
  /** Shown when a dropped file has the wrong type; "{types}" is replaced by `extensions`. */
  wrongType: string;
}

/**
 * Dashed drop zone around a real `<input type="file">`: click (or keyboard) opens the
 * picker, and a file dropped anywhere on the zone is put into the input, so the
 * surrounding form submits it exactly as if it had been picked. The input stays in the
 * form (visually hidden, still focusable and `required`).
 */
export function FileDropZone({
  id,
  name,
  accept,
  extensions,
  badge,
  note,
  required = false,
  labels,
}: {
  id: string;
  name: string;
  accept: string;
  /** Lower-case extensions accepted on drop, e.g. [".csv"]. */
  extensions: string[];
  /** Short mono badge, e.g. "↑ .csv". */
  badge: string;
  /** Optional extra line, e.g. the supported banks. */
  note?: string;
  required?: boolean;
  labels: FileDropZoneLabels;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();

  const accepts = (file: File) => extensions.some((ext) => file.name.toLowerCase().endsWith(ext));

  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    const input = inputRef.current;
    if (!file || !input) return;
    if (!accepts(file)) {
      setError(labels.wrongType.replace("{types}", extensions.join(", ")));
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    setError(undefined);
    setFileName(file.name);
  };

  const border = error
    ? "border-status-danger"
    : dragging
      ? "border-primary bg-surface-container-low"
      : fileName
        ? "border-primary"
        : "border-outline-variant hover:border-primary";

  return (
    <label
      htmlFor={id}
      onDragEnter={onDragOver}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
      className={`w-full border-2 border-dashed bg-surface rounded-sm p-8 transition-colors cursor-pointer flex flex-col items-center gap-2 text-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${border}`}
    >
      <span aria-hidden className="font-mono text-[24px] leading-none text-outline">
        {badge}
      </span>
      <span className="text-headline-sm text-on-surface">{dragging ? labels.dropHere : labels.title}</span>
      {fileName ? (
        <span className="text-label-md text-primary font-semibold break-all">{labels.selected.replace("{name}", fileName)}</span>
      ) : (
        <span className="text-label-sm text-on-surface-variant">{labels.hint}</span>
      )}
      {note ? <span className="text-label-sm text-on-surface-variant">{note}</span> : null}
      {error ? (
        <span role="alert" className="text-label-sm text-status-danger">
          {error}
        </span>
      ) : null}
      <input
        ref={inputRef}
        id={id}
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="sr-only"
        onChange={(event) => {
          setError(undefined);
          setFileName(event.currentTarget.files?.[0]?.name);
        }}
      />
    </label>
  );
}
