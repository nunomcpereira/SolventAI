"use client";

import { useEffect, useState, useTransition } from "react";
import { switchTenantAction, createDemoTenantAction } from "../../app/tenantActions.js";

const LOCAL_STORAGE_KEY = "solvent_tenant";

interface TenantOption {
  id: string;
  name: string;
}

export function TenantSwitcher({
  tenants,
  currentTenantId,
  createDemoLabel,
  label,
}: {
  tenants: TenantOption[];
  currentTenantId: string;
  createDemoLabel: string;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  // Mirrors the active tenant to localStorage purely as a client-side memory of what
  // was last loaded in this browser — the cookie (set by the server actions below)
  // remains the actual source of truth used for server-side rendering.
  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, currentTenantId);
    } catch {
      // Storage unavailable (private browsing, etc.) — non-critical, ignore.
    }
  }, [currentTenantId]);

  const [pendingId, setPendingId] = useState(currentTenantId);

  return (
    <div className="flex items-end gap-2">
      <label className="flex-1 min-w-0 flex flex-col gap-1 text-[11.5px] text-[var(--sidebar-fg)]">
        {label}
        <select
          value={pendingId}
          disabled={isPending}
          onChange={(event) => {
            const tenantId = event.target.value;
            setPendingId(tenantId);
            const formData = new FormData();
            formData.set("tenantId", tenantId);
            startTransition(async () => {
              await switchTenantAction(formData);
              window.location.reload();
            });
          }}
          className="w-full rounded-sm border border-[var(--sidebar-border)] !bg-[var(--sidebar-field-bg)] text-[var(--sidebar-strong)] px-2 py-1.5 text-[13px] disabled:opacity-60"
        >
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={isPending}
        title={createDemoLabel}
        aria-label={createDemoLabel}
        onClick={() => {
          startTransition(async () => {
            await createDemoTenantAction();
            window.location.reload();
          });
        }}
        className="h-[31px] w-[31px] shrink-0 rounded-sm border border-[var(--sidebar-border)] !bg-[var(--sidebar-field-bg)] text-[var(--sidebar-fg)] hover:text-[var(--sidebar-accent)] hover:border-[var(--sidebar-accent)] font-mono text-[15px] inline-flex items-center justify-center disabled:opacity-60"
      >
        +
      </button>
    </div>
  );
}
