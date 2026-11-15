"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export interface BackupPanelLabels {
  download: string;
  downloadHelp: string;
  restoreTitle: string;
  restoreHelp: string;
  chooseFile: string;
  confirm: string;
  restore: string;
  restoring: string;
  success: string;
  safetyCopy: string;
  errors: Record<"too-large" | "not-sqlite" | "corrupt" | "not-solvent" | "newer-version" | "forbidden" | "unknown", string>;
}

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; safetyCopy?: string | undefined } | { kind: "error"; message: string };

/** Settings panel: download the current profile's database, or restore it from a file. */
export function BackupPanel({ labels }: { labels: BackupPanelLabels }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  async function onRestore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file === null || !confirmed) return;
    setStatus({ kind: "busy" });
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/backup", { method: "POST", body });
      const result = (await response.json()) as { ok: boolean; error?: string; safetyCopy?: string };
      if (result.ok) {
        setStatus({ kind: "ok", safetyCopy: result.safetyCopy });
        setFile(null);
        setConfirmed(false);
        formRef.current?.reset();
        router.refresh();
      } else {
        const key = (result.error ?? "unknown") as keyof BackupPanelLabels["errors"];
        setStatus({ kind: "error", message: labels.errors[key] ?? labels.errors.unknown });
      }
    } catch {
      setStatus({ kind: "error", message: labels.errors.unknown });
    }
  }

  return (
    <div className="flex flex-col gap-stack-md">
      <div className="flex flex-col gap-1">
        <a
          href="/api/backup"
          download
          className="self-start inline-flex items-center gap-2 bg-primary text-on-primary rounded-lg px-5 py-2.5 text-label-md font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          {labels.download}
        </a>
        <span className="text-label-sm text-on-surface-variant">{labels.downloadHelp}</span>
      </div>

      <form ref={formRef} onSubmit={onRestore} className="flex flex-col gap-stack-sm border-t border-outline-variant pt-stack-md">
        <p className="text-body-md font-medium text-on-surface">{labels.restoreTitle}</p>
        <p className="text-label-sm text-on-surface-variant">{labels.restoreHelp}</p>
        <label className="flex flex-col gap-1">
          <span className="text-label-sm text-on-surface-variant">{labels.chooseFile}</span>
          <input
            type="file"
            name="file"
            accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3,application/x-sqlite3"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setStatus({ kind: "idle" });
            }}
            className="text-body-sm text-on-surface"
          />
        </label>
        <label className="flex items-start gap-2 text-body-sm text-on-surface">
          <input
            type="checkbox"
            name="confirmRestore"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1"
          />
          <span>{labels.confirm}</span>
        </label>
        <button
          type="submit"
          disabled={file === null || !confirmed || status.kind === "busy"}
          className="self-start border border-status-warning text-status-warning rounded-lg px-5 py-2.5 text-label-md font-medium hover:bg-status-warning/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status.kind === "busy" ? labels.restoring : labels.restore}
        </button>
        <div role="status" aria-live="polite">
          {status.kind === "ok" ? (
            <p className="text-label-sm text-status-healthy">
              {labels.success}
              {status.safetyCopy ? ` ${labels.safetyCopy.replace("{file}", status.safetyCopy)}` : ""}
            </p>
          ) : null}
          {status.kind === "error" ? <p className="text-label-sm text-status-danger">{status.message}</p> : null}
        </div>
      </form>
    </div>
  );
}
