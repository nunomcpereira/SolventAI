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
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-label-sm text-on-surface-variant">
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
          className="border border-outline-variant rounded-lg px-3 py-1.5 text-label-md bg-surface-container-low focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
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
        className="w-8 h-8 rounded-full border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary hover:bg-surface-container-low transition-colors inline-flex items-center justify-center disabled:opacity-60"
      >
        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
          add_moderator
        </span>
      </button>
    </div>
  );
}
