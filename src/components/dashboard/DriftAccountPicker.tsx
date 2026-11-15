import Link from "next/link";

/** Links that switch the projected-vs-actual chart between all accounts and one account. */
export function DriftAccountPicker({
  lang,
  selected,
  accounts,
  allValue,
  allLabel,
  ariaLabel,
  monthOffset,
}: {
  lang: string;
  selected: string | undefined;
  accounts: { id: string; name: string }[];
  allValue: string;
  allLabel: string;
  ariaLabel: string;
  monthOffset: number;
}) {
  const options = [{ id: allValue, name: allLabel }, ...accounts];
  const href = (id: string) => {
    const qs = new URLSearchParams();
    if (monthOffset !== 0) qs.set("monthOffset", String(monthOffset));
    if (id !== allValue) qs.set("drift", id);
    const query = qs.toString();
    return `/${lang}/dashboard${query ? `?${query}` : ""}#balance-drift`;
  };
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-2 mb-4">
      {options.map((o) => (
        <Link
          key={o.id}
          href={href(o.id)}
          scroll={false}
          aria-current={o.id === selected ? "true" : undefined}
          className={`text-label-sm px-2.5 py-1 rounded-sm border transition-colors ${
            o.id === selected ? "border-primary text-primary" : "border-outline-variant text-on-surface-variant hover:text-on-surface"
          }`}
        >
          {o.name}
        </Link>
      ))}
    </nav>
  );
}
