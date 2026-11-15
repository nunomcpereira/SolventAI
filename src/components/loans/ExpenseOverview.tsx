import { type Dictionary } from "../../lib/i18n/getDictionary.js";
import { type ExpenseStats } from "../../lib/services/expenseStatsService.js";
import { formatMoney } from "../../lib/format.js";
import { Money } from "../../engine/money/money.js";
import { ExpenseAllocationPie, type AllocationSlice } from "../charts/ExpenseAllocationPie.js";

/** Fixed hue per category (color follows the category, never its rank). The rest fold into a gray "other". */
const CATEGORY_SLOT: Record<string, number> = {
  housing: 1,
  food: 2,
  utilities: 3,
  transport: 4,
  insurance: 5,
  healthcare: 6,
  subscriptions: 7,
  discretionary: 8,
};
const OTHER_KEY = "__other";

function percent(share: number, lang: string): string {
  return new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: share < 0.1 ? 1 : 0 }).format(share);
}

export function ExpenseOverview({ stats, dict, lang }: { stats: ExpenseStats; dict: Dictionary; lang: string }) {
  const t = dict.expenseStats;
  const categoryNames = dict.importer.categories as Record<string, string>;
  const { allocation, currency, monthlyLoanPayments, monthlyIncome } = stats;
  if (allocation.itemCount === 0) return null;

  // Fold categories without a hue of their own into one "other" slice.
  const folded = allocation.categories.filter((c) => CATEGORY_SLOT[c.category] === undefined);
  const own = allocation.categories.filter((c) => CATEGORY_SLOT[c.category] !== undefined);
  const rows = [
    ...own.map((c) => ({
      key: c.category,
      label: categoryNames[c.category] ?? c.category,
      monthly: c.monthly,
      share: c.share,
      itemCount: c.itemCount,
      color: `var(--chart-cat-${CATEGORY_SLOT[c.category]})`,
    })),
    ...(folded.length > 0
      ? [
          {
            key: OTHER_KEY,
            label: folded.map((c) => categoryNames[c.category] ?? c.category).join(" + "),
            monthly: folded.reduce((acc, c) => acc.add(c.monthly), Money.zero(currency)),
            share: folded.reduce((acc, c) => acc + c.share, 0),
            itemCount: folded.reduce((acc, c) => acc + c.itemCount, 0),
            color: "var(--chart-cat-other)",
          },
        ]
      : []),
  ].sort((a, b) => b.monthly.compare(a.monthly));

  const slices: AllocationSlice[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: Number(r.monthly.toDecimalString()),
    formattedValue: formatMoney(r.monthly, lang),
    formattedShare: percent(r.share, lang),
    color: r.color,
  }));

  const totalOut = allocation.totalMonthly.add(monthlyLoanPayments);
  const income = Number(monthlyIncome.toDecimalString());
  const outShare = income > 0 ? Number(totalOut.toDecimalString()) / income : undefined;
  const leftover = monthlyIncome.sub(totalOut);
  const perMonth = t.perMonth;

  const tiles = [
    {
      label: t.averageMonthly,
      value: formatMoney(allocation.totalMonthly, lang),
      note: t.activeItems.replace("{count}", String(allocation.itemCount)),
      hero: true,
    },
    { label: t.perYear, value: formatMoney(allocation.totalMonthly.mulFraction(12n, 1n), lang), note: t.perYearNote, hero: false },
    {
      label: t.loanPayments,
      value: formatMoney(monthlyLoanPayments, lang),
      note: t.totalOut.replace("{amount}", formatMoney(totalOut, lang)),
      hero: false,
    },
    {
      label: t.shareOfIncome,
      value: outShare !== undefined ? percent(outShare, lang) : "—",
      note:
        outShare !== undefined
          ? (leftover.isNegative() ? t.shortfall : t.leftover).replace("{amount}", formatMoney(leftover.abs(), lang))
          : t.noIncome,
      hero: false,
    },
  ];

  return (
    <section aria-labelledby="expense-overview-title" className="flex flex-col gap-stack-md mb-stack-lg">
      <h3 id="expense-overview-title" className="sr-only">
        {t.title}
      </h3>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-stack-md gap-y-stack-sm border-b border-outline-variant pb-stack-md">
        {tiles.map((tile) => (
          <div key={tile.label} className="min-w-0">
            <dt className="eyebrow">{tile.label}</dt>
            <dd className={`figure leading-tight mt-1 ${tile.hero ? "text-[26px] md:text-[30px] text-primary" : "text-[20px] md:text-[22px] text-on-surface"}`}>
              {tile.value}
            </dd>
            <dd className="text-label-sm text-on-surface-variant mt-0.5">{tile.note}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,240px)_1fr] gap-stack-md items-center">
        <ExpenseAllocationPie slices={slices} ariaLabel={t.chartLabel} />
        <div className="min-w-0">
          <p className="eyebrow mb-2">{t.allocationTitle}</p>
          <table className="w-full table-fixed text-body-md">
            <caption className="sr-only">{t.allocationTitle}</caption>
            <colgroup>
              <col />
              <col className="w-[7.5rem] md:w-40" />
              <col className="w-12 md:w-14" />
            </colgroup>
            <thead className="sr-only">
              <tr>
                <th scope="col">{t.category}</th>
                <th scope="col">{perMonth}</th>
                <th scope="col">{t.share}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-outline-variant last:border-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-on-surface">
                    <span className="flex items-center gap-2 min-w-0">
                      <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: r.color }} />
                      <span className="truncate" title={r.label}>{r.label}</span>
                    </span>
                  </th>
                  <td className="py-1.5 pr-2 text-right font-mono text-[13px] md:text-body-md text-on-surface whitespace-nowrap">
                    {formatMoney(r.monthly, lang)}
                    <span className="text-on-surface-variant">{perMonth}</span>
                  </td>
                  <td className="py-1.5 text-right font-mono text-[13px] md:text-body-md text-on-surface-variant">{percent(r.share, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-label-sm text-on-surface-variant mt-2">{t.howComputed}</p>
        </div>
      </div>
    </section>
  );
}
