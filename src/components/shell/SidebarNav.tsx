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
    <nav className="flex-1 flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "flex items-center gap-3 px-4 py-3 rounded-lg text-primary font-bold border-r-4 border-primary bg-surface-container-high transition-all"
                : "flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all"
            }
          >
            <span className="material-symbols-outlined" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              {item.icon}
            </span>
            <span className="text-label-md">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 w-full z-[70] flex justify-around items-center h-16 pb-[env(safe-area-inset-bottom)] bg-surface-container-lowest border-t border-outline-variant lg:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-xl px-4 py-1 transition-transform duration-200"
                : "flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:text-primary"
            }
          >
            <span className="material-symbols-outlined" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              {item.icon}
            </span>
            <span className="text-label-sm">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
