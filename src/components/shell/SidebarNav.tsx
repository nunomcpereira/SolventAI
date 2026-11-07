"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type NavItem } from "./navItems.js";

function isActive(pathname: string, item: NavItem): boolean {
  return item.matchSegments.some((segment) => pathname.includes(`/${segment}`));
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col px-3">
      {items.map((item, index) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-baseline gap-3 px-3 py-2 text-[14px] transition-colors ${
              active ? "text-[var(--sidebar-strong)] font-medium bg-[var(--sidebar-active-bg)]" : "text-[var(--sidebar-fg)] hover:text-[var(--sidebar-strong)] hover:bg-[var(--sidebar-hover-bg)]"
            }`}
          >
            {active ? <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[2px] bg-[var(--sidebar-accent)]" /> : null}
            <span className={`font-mono text-[11px] ${active ? "text-[var(--sidebar-accent)]" : "text-[var(--sidebar-muted)]"}`}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-[70] flex items-stretch h-16 pb-[env(safe-area-inset-bottom)] bg-[var(--sidebar-bg)] border-t border-[var(--sidebar-border)] lg:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-1 border-t-2 ${
              active ? "border-[var(--sidebar-accent)] text-[var(--sidebar-strong)]" : "border-transparent text-[var(--sidebar-fg)]"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
              {item.icon}
            </span>
            <span className="text-[10.5px] leading-tight text-center px-1 line-clamp-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
