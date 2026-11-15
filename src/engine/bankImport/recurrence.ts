import { Money } from "../money/money.js";
import { IsoDate } from "../dates/isoDate.js";
import { type Frequency } from "../dates/frequency.js";
import {
  merchantKey,
  displayLabel,
  normalizeText,
  guessExpenseCategory,
  guessIncomeCategory,
  looksLikeLoanPayment,
  looksLikeOwnTransfer,
  looksLikeSavings,
} from "./merchant.js";

/**
 * Deterministic detection of recurring income, expenses and own-account transfers from
 * an account's bank-statement history, turned into proposals the user reviews. Nothing
 * here writes anything: the caller shows the proposals and creates only what the user
 * accepts. No AI, no randomness — the same history always yields the same proposals.
 *
 * Passes, in order (each transaction is used by at most one proposal):
 *  1. Group by counterparty (merchantKey) and direction.
 *  2. Periodic series (weekly … semiannual) per group: tiny same-counterparty movements
 *     (< 20% of the group's median, e.g. expense reimbursements) are ignored, movements
 *     closer together than 40% of the period are merged (two bills in one month), and
 *     ≥ 60% of the gaps must match the period (80% for weekly/biweekly). Amounts well above the usual (> 1.6×, e.g.
 *     a yearly bonus paid with the salary) are split off; when they recur in the same
 *     month in different years they become their own annual proposal.
 *  3. Annual pairs for what isn't periodic: the same counterparty about a year apart
 *     with a similar amount (insurance, IUC/IMI).
 *  4. Average monthly transfers to the holder's other accounts that aren't periodic.
 *  5. Everything else that left the account (groceries, fuel, cash…) becomes an
 *     average monthly amount per category, over the last full months.
 * Series that stopped (no movement for 1.5 periods) are not proposed; when a new series
 * in the same category starts right after, it is marked as replacing the old one.
 */

export interface HistoryTransaction {
  id: string;
  date: IsoDate;
  description: string;
  /** Signed: negative = money out. */
  amount: Money;
  bankCategory?: string;
}

export interface KnownAccount {
  id: string;
  name: string;
  type: string;
}

export interface KnownLoanPayment {
  loanId: string;
  name: string;
  /** Current periodic payment (positive). */
  amount: Money;
}

export interface KnownRecurringItem {
  id: string;
  kind: "expense" | "income";
  category: string;
  amount: Money;
  frequency: Frequency;
}

export interface KnownTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: Money;
  frequency: Frequency;
}

export interface DetectionInput {
  accountId: string;
  currency: string;
  transactions: readonly HistoryTransaction[];
  /** Last day the history covers (statement end); "is it still active" is judged from here. */
  asOf: IsoDate;
  /** First day the history covers (statement start); defaults to the first transaction. */
  historyStart?: IsoDate;
  /** The holder's other accounts, for own-transfer targets. */
  otherAccounts: readonly KnownAccount[];
  /** Loans paid from this account. */
  loanPayments: readonly KnownLoanPayment[];
  /** Recurring incomes/expenses already configured on this account. */
  existingItems: readonly KnownRecurringItem[];
  /** Recurring transfers already configured from this account. */
  existingTransfers: readonly KnownTransfer[];
}

export type ProposalKind = "expense" | "income" | "transfer";
export type ProposalSource = "recurring" | "annual" | "extra" | "average";
export type ProposalStatus = "new" | "exists" | "update" | "covered_by_loan";
export type Confidence = "high" | "medium" | "low";

export interface ProposalOccurrence {
  id: string;
  date: IsoDate;
  /** Positive. */
  amount: Money;
  description: string;
}

export interface Proposal {
  /** Stable across re-runs on the same history — used to remember dismissals. */
  key: string;
  kind: ProposalKind;
  source: ProposalSource;
  label: string;
  frequency: Frequency;
  /** Positive amount per occurrence. */
  amount: Money;
  category: string;
  /** Proposed start date for the recurring item: the last seen occurrence (so the day of
   * month carries over), or the day after the history ends for averages. */
  startDate: IsoDate;
  firstDate: IsoDate;
  lastDate: IsoDate;
  occurrences: ProposalOccurrence[];
  confidence: Confidence;
  /** The amount varies between occurrences (an estimate, not a fixed price). */
  variableAmount: boolean;
  status: ProposalStatus;
  /** Existing item (status exists/update) or loan (covered_by_loan) this matches. */
  matchId?: string;
  matchAmount?: Money;
  /** Transfer target account, when known. */
  toAccountId?: string;
  /** Label of a series that stopped just before this one started (e.g. a supplier change). */
  replaces?: string;
  /** For averages: how many full months were averaged. */
  monthsCovered?: number;
}

interface Tx {
  id: string;
  date: IsoDate;
  description: string;
  abs: Money;
  credit: boolean;
  bankCategory?: string;
}

interface Group {
  key: string;
  credit: boolean;
  txs: Tx[];
  label: string;
}

interface PeriodSpec {
  frequency: Frequency;
  days: number;
  min: number;
  max: number;
  minCount: number;
  /** Share of gaps that must match the period. */
  minRegularity: number;
}

const PERIODS: readonly PeriodSpec[] = [
  // Short periods need to be very regular: shopping every ~10 days is not a weekly bill.
  { frequency: "weekly", days: 7, min: 5, max: 9, minCount: 6, minRegularity: 0.8 },
  { frequency: "biweekly", days: 14, min: 12, max: 17, minCount: 4, minRegularity: 0.8 },
  { frequency: "monthly", days: 30.44, min: 25, max: 36, minCount: 3, minRegularity: 0.6 },
  { frequency: "quarterly", days: 91.3, min: 80, max: 100, minCount: 3, minRegularity: 0.6 },
  { frequency: "semiannual", days: 182.6, min: 165, max: 200, minCount: 3, minRegularity: 0.6 },
];

const ANNUAL = { min: 335, max: 395, days: 365.25 };
const NOISE_RATIO = 0.2;
const OUTLIER_RATIO = 1.6;
const FIXED_AMOUNT_CV = 0.1;
const AVERAGE_MONTHS = 12;
const MIN_AVERAGE_MONTHS = 3;

const toNumber = (m: Money) => Number(m.toDecimalString());

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function coefficientOfVariation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function meanMoney(values: readonly Money[], currency: string): Money {
  const total = values.reduce((acc, v) => acc.add(v), Money.zero(currency));
  return values.length === 0 ? total : total.mulFraction(1n, BigInt(values.length));
}

const monthKey = (d: IsoDate) => d.year * 12 + (d.month - 1);

interface Merged {
  date: IsoDate;
  abs: Money;
  txs: Tx[];
}

/** Merges movements closer together than `windowDays` to the cluster's first one. */
function mergeClose(txs: readonly Tx[], windowDays: number, currency: string): Merged[] {
  const out: Merged[] = [];
  for (const tx of txs) {
    const last = out[out.length - 1];
    if (last && last.date.daysUntil(tx.date) < windowDays) {
      last.abs = last.abs.add(tx.abs);
      last.txs.push(tx);
    } else {
      out.push({ date: tx.date, abs: tx.abs.add(Money.zero(currency)), txs: [tx] });
    }
  }
  return out;
}

interface PeriodicResult {
  period: PeriodSpec;
  regularity: number;
  series: Merged[];
  outliers: Merged[];
  ignored: Tx[];
}

function analyzePeriodic(group: Group, currency: string): PeriodicResult | undefined {
  const groupMedian = median(group.txs.map((t) => toNumber(t.abs)));
  const core = group.txs.filter((t) => toNumber(t.abs) >= groupMedian * NOISE_RATIO);
  const ignored = group.txs.filter((t) => toNumber(t.abs) < groupMedian * NOISE_RATIO);
  if (core.length < 3) return undefined;

  const perMonth = new Map<number, number>();
  for (const t of core) perMonth.set(monthKey(t.date), (perMonth.get(monthKey(t.date)) ?? 0) + 1);
  const typicalPerMonth = median([...perMonth.values()]);

  let best: PeriodicResult | undefined;
  for (const period of PERIODS) {
    if (period.days >= 28 && typicalPerMonth > 2) continue; // a frequent merchant, not a monthly bill
    const merged = period.days >= 28 ? mergeClose(core, period.days * 0.4, currency) : core.map((t) => ({ date: t.date, abs: t.abs, txs: [t] }));
    if (merged.length < period.minCount) continue;
    let score = 0;
    for (let i = 1; i < merged.length; i++) {
      const gap = merged[i - 1]!.date.daysUntil(merged[i]!.date);
      if (gap >= period.min && gap <= period.max) score += 1;
      else if (gap >= period.min * 2 && gap <= period.max * 2) score += 0.5; // one missed occurrence
    }
    const regularity = score / (merged.length - 1);
    if (regularity < period.minRegularity) continue;
    if (best && regularity <= best.regularity) continue;
    const mergedMedian = median(merged.map((m) => toNumber(m.abs)));
    const outliers = merged.filter((m) => toNumber(m.abs) > mergedMedian * OUTLIER_RATIO);
    best = { period, regularity, series: merged, outliers, ignored };
  }
  return best;
}

function confidenceFor(regularity: number, count: number): Confidence {
  if (regularity >= 0.85 && count >= 6) return "high";
  if (regularity >= 0.7) return "medium";
  return "low";
}

function occurrencesOf(txs: readonly Tx[]): ProposalOccurrence[] {
  return txs.map((t) => ({ id: t.id, date: t.date, amount: t.abs, description: t.description }));
}

interface EndedSeries {
  label: string;
  category: string;
  frequency: Frequency;
  lastDate: IsoDate;
  periodDays: number;
}

export function detectRecurring(input: DetectionInput): Proposal[] {
  const { currency, asOf } = input;
  const txs: Tx[] = input.transactions
    .filter((t) => !t.amount.isZero() && t.amount.currency === currency)
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      abs: t.amount.abs(),
      credit: t.amount.isPositive(),
      ...(t.bankCategory !== undefined ? { bankCategory: t.bankCategory } : {}),
    }))
    .sort((a, b) => a.date.compare(b.date) || a.id.localeCompare(b.id));
  if (txs.length === 0) return [];

  const groupsByKey = new Map<string, Group>();
  for (const tx of txs) {
    const key = `${tx.credit ? "c" : "d"}:${merchantKey(tx.description)}`;
    let group = groupsByKey.get(key);
    if (!group) {
      group = { key, credit: tx.credit, txs: [], label: "" };
      groupsByKey.set(key, group);
    }
    group.txs.push(tx);
  }
  const groups = [...groupsByKey.values()];
  for (const g of groups) g.label = displayLabel(g.txs.map((t) => t.description));

  const targetFor = (group: Group): KnownAccount | undefined => {
    const compact = group.key.slice(2);
    const byName = input.otherAccounts.find((a) => {
      const name = normalizeText(a.name).replace(/[^A-Z0-9]/g, "");
      return name.length >= 4 && compact.includes(name);
    });
    if (byName) return byName;
    if (group.txs.some((t) => looksLikeSavings(t.description))) {
      return input.otherAccounts.find((a) => a.type === "savings") ?? input.otherAccounts.find((a) => a.type === "emergency");
    }
    return undefined;
  };
  const isOwnTransfer = (group: Group) =>
    !group.credit && (group.txs.some((t) => looksLikeOwnTransfer(t.description)) || targetFor(group) !== undefined);

  const expenseCategory = (group: Group) => {
    const counts = new Map<string, number>();
    for (const t of group.txs) {
      const c = guessExpenseCategory(t.description, t.bankCategory);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
  };

  const used = new Set<string>();
  const proposals: Proposal[] = [];
  const ended: EndedSeries[] = [];

  // 2. Periodic series.
  for (const group of groups) {
    const result = analyzePeriodic(group, currency);
    if (!result) continue;
    const { period, regularity, series, outliers } = result;
    const last = series[series.length - 1]!;
    const regular = series.filter((m) => !outliers.includes(m));
    const recent = regular.slice(-6);
    const cv = coefficientOfVariation(recent.map((m) => toNumber(m.abs)));
    const variableAmount = cv > FIXED_AMOUNT_CV;
    const amount = variableAmount ? meanMoney(recent.map((m) => m.abs), currency) : recent[recent.length - 1]!.abs;
    const ownTransfer = isOwnTransfer(group);
    const kind: ProposalKind = group.credit ? "income" : ownTransfer ? "transfer" : "expense";
    const category = kind === "expense" ? expenseCategory(group) : kind === "income" ? (guessIncomeCategory(group.label) ?? "other") : "transfer";
    const active = last.date.daysUntil(asOf) <= period.days * 1.5 + 7;

    if (!active) {
      ended.push({ label: group.label, category, frequency: period.frequency, lastDate: last.date, periodDays: period.days });
      continue;
    }
    for (const m of series) for (const t of m.txs) used.add(t.id);
    for (const t of result.ignored) used.add(t.id);

    const target = kind === "transfer" ? targetFor(group) : undefined;
    proposals.push({
      key: `r:${group.key}`,
      kind,
      source: "recurring",
      label: group.label,
      frequency: period.frequency,
      amount,
      category,
      startDate: last.date,
      firstDate: series[0]!.date,
      lastDate: last.date,
      occurrences: occurrencesOf(series.flatMap((m) => m.txs)),
      confidence: confidenceFor(regularity, series.length),
      variableAmount,
      status: "new",
      ...(target ? { toAccountId: target.id } : {}),
    });

    // Recurring extras (e.g. a yearly bonus paid with the April salary).
    const byMonth = new Map<number, Merged[]>();
    for (const o of outliers) byMonth.set(o.date.month, [...(byMonth.get(o.date.month) ?? []), o]);
    for (const [month, list] of byMonth) {
      const years = new Set(list.map((o) => o.date.year));
      if (years.size < 2) continue;
      const latest = list[list.length - 1]!;
      if (latest.date.daysUntil(asOf) > ANNUAL.max + 30) continue;
      const extra = latest.abs.sub(amount);
      if (!extra.isPositive()) continue;
      proposals.push({
        key: `x:${group.key}:${month}`,
        kind,
        source: "extra",
        label: group.label,
        frequency: "annual",
        amount: extra,
        category: kind === "income" ? "bonus" : category,
        startDate: latest.date,
        firstDate: list[0]!.date,
        lastDate: latest.date,
        occurrences: occurrencesOf(list.flatMap((m) => m.txs)),
        confidence: "medium",
        variableAmount: coefficientOfVariation(list.map((o) => toNumber(o.abs))) > FIXED_AMOUNT_CV,
        status: "new",
      });
    }
  }

  // 3. Annual pairs among what's left — only for counterparties seen about twice a year
  // or less: frequent ones (MB WAY, card fees, groceries) pair up by pure chance.
  const historyYears = Math.max(1, txs[0]!.date.daysUntil(asOf) / ANNUAL.days);
  for (const group of groups) {
    if (group.txs.length > Math.max(3, Math.ceil(2 * historyYears))) continue;
    const remaining = group.txs.filter((t) => !used.has(t.id));
    const linked = new Set<string>();
    for (let i = 0; i < remaining.length; i++) {
      const start = remaining[i]!;
      if (linked.has(start.id)) continue;
      const chain: Tx[] = [start];
      let current = start;
      for (;;) {
        let next: Tx | undefined;
        let bestDistance = Infinity;
        for (const cand of remaining) {
          if (linked.has(cand.id) || chain.includes(cand)) continue;
          const gap = current.date.daysUntil(cand.date);
          if (gap < ANNUAL.min || gap > ANNUAL.max) continue;
          const ratio = toNumber(cand.abs) / toNumber(current.abs);
          if (ratio < 0.75 || ratio > 1.33) continue;
          const distance = Math.abs(gap - ANNUAL.days);
          if (distance < bestDistance) {
            next = cand;
            bestDistance = distance;
          }
        }
        if (!next) break;
        chain.push(next);
        current = next;
      }
      if (chain.length < 2) continue;
      const last = chain[chain.length - 1]!;
      if (last.date.daysUntil(asOf) > ANNUAL.max + 30) continue;
      for (const t of chain) {
        linked.add(t.id);
        used.add(t.id);
      }
      const ownTransfer = isOwnTransfer(group);
      const kind: ProposalKind = group.credit ? "income" : ownTransfer ? "transfer" : "expense";
      const spread = Math.abs(toNumber(last.abs) / toNumber(chain[chain.length - 2]!.abs) - 1);
      const target = kind === "transfer" ? targetFor(group) : undefined;
      proposals.push({
        key: `a:${group.key}:${last.date.month}`,
        kind,
        source: "annual",
        label: group.label,
        frequency: "annual",
        amount: last.abs,
        category: kind === "expense" ? expenseCategory(group) : kind === "income" ? (guessIncomeCategory(group.label) ?? "other") : "transfer",
        startDate: last.date,
        firstDate: chain[0]!.date,
        lastDate: last.date,
        occurrences: occurrencesOf(chain),
        confidence: chain.length >= 3 ? "high" : spread <= 0.15 ? "medium" : "low",
        variableAmount: spread > FIXED_AMOUNT_CV,
        status: "new",
        ...(target ? { toAccountId: target.id } : {}),
      });
    }
  }

  // Full calendar months the history covers, most recent last, at most AVERAGE_MONTHS.
  const firstDate = input.historyStart && input.historyStart.isBefore(txs[0]!.date) ? input.historyStart : txs[0]!.date;
  const firstFullMonth = firstDate.day === 1 ? monthKey(firstDate) : monthKey(firstDate) + 1;
  const asOfIsMonthEnd = asOf.addDays(1).month !== asOf.month;
  const lastFullMonth = asOfIsMonthEnd ? monthKey(asOf) : monthKey(asOf) - 1;
  const months: number[] = [];
  for (let m = Math.max(firstFullMonth, lastFullMonth - AVERAGE_MONTHS + 1); m <= lastFullMonth; m++) months.push(m);
  const averageStart = asOf.addDays(1);

  /** Trimmed mean of monthly totals (drops the best and worst month once there are 6+). */
  const monthlyAverage = (items: readonly Tx[]): Money => {
    const totals = months.map((m) =>
      items.filter((t) => monthKey(t.date) === m).reduce((acc, t) => acc.add(t.abs), Money.zero(currency)),
    );
    const sorted = [...totals].sort((a, b) => a.compare(b));
    const trimmed = sorted.length >= 6 ? sorted.slice(1, -1) : sorted;
    return meanMoney(trimmed, currency);
  };
  const inWindow = (t: Tx) => months.includes(monthKey(t.date));

  if (months.length >= MIN_AVERAGE_MONTHS) {
    // 4. Non-periodic transfers to a known own account, averaged per target. Ones that
    // look like own-account transfers but name no known account are averaged per
    // counterparty, without a target (the user picks one, or turns it into an expense).
    const byTarget = new Map<string, Tx[]>();
    for (const group of groups) {
      if (group.credit) continue;
      const target = targetFor(group);
      const rest = group.txs.filter((t) => !used.has(t.id));
      if (target) {
        byTarget.set(target.id, [...(byTarget.get(target.id) ?? []), ...rest]);
        continue;
      }
      if (!isOwnTransfer(group)) continue;
      for (const t of rest) used.add(t.id);
      const windowed = rest.filter(inWindow);
      const amount = windowed.length > 0 ? monthlyAverage(windowed) : Money.zero(currency);
      if (!amount.isPositive()) continue;
      proposals.push({
        key: `t:?:${group.key}`,
        kind: "transfer",
        source: "average",
        label: group.label,
        frequency: "monthly",
        amount,
        category: "transfer",
        startDate: averageStart,
        firstDate: windowed[0]!.date,
        lastDate: windowed[windowed.length - 1]!.date,
        occurrences: occurrencesOf(windowed),
        confidence: "low",
        variableAmount: true,
        status: "new",
        monthsCovered: months.length,
      });
    }
    for (const [targetId, list] of byTarget) {
      for (const t of list) used.add(t.id);
      const windowed = list.filter(inWindow);
      if (windowed.length === 0) continue;
      const amount = monthlyAverage(windowed);
      if (!amount.isPositive()) continue;
      const target = input.otherAccounts.find((a) => a.id === targetId)!;
      proposals.push({
        key: `t:${targetId}`,
        kind: "transfer",
        source: "average",
        label: target.name,
        frequency: "monthly",
        amount,
        category: "transfer",
        startDate: averageStart,
        firstDate: windowed[0]!.date,
        lastDate: windowed[windowed.length - 1]!.date,
        occurrences: occurrencesOf(windowed),
        confidence: months.length >= 6 ? "medium" : "low",
        variableAmount: true,
        status: "new",
        toAccountId: targetId,
        monthsCovered: months.length,
      });
    }

    // 5. Everything else that left the account, averaged per category.
    const byCategory = new Map<string, Tx[]>();
    for (const tx of txs) {
      if (tx.credit || used.has(tx.id) || !inWindow(tx)) continue;
      const category = guessExpenseCategory(tx.description, tx.bankCategory);
      byCategory.set(category, [...(byCategory.get(category) ?? []), tx]);
    }
    for (const [category, list] of [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const amount = monthlyAverage(list);
      if (!amount.isPositive()) continue;
      proposals.push({
        key: `v:${category}`,
        kind: "expense",
        source: "average",
        label: category,
        frequency: "monthly",
        amount,
        category,
        startDate: averageStart,
        firstDate: list[0]!.date,
        lastDate: list[list.length - 1]!.date,
        occurrences: occurrencesOf(list),
        confidence: months.length >= 6 ? "medium" : "low",
        variableAmount: true,
        status: "new",
        monthsCovered: months.length,
      });
    }
  }

  // Supplier changes: a series that stopped right before a new one in the same category began.
  for (const p of proposals) {
    if (p.source !== "recurring" || p.category === "other") continue;
    const periodDays = PERIODS.find((s) => s.frequency === p.frequency)?.days ?? 30;
    const previous = ended
      .filter((e) => e.category === p.category && e.frequency === p.frequency && e.lastDate.isBefore(p.firstDate.addDays(Math.ceil(periodDays))))
      .filter((e) => e.lastDate.daysUntil(p.firstDate) <= periodDays * 3)
      .sort((a, b) => b.lastDate.compare(a.lastDate))[0];
    if (previous) p.replaces = previous.label;
  }

  // The largest monthly income with no telling description is, in practice, the salary.
  const salaryCandidate = proposals
    .filter((p) => p.kind === "income" && p.source === "recurring" && p.frequency === "monthly")
    .sort((a, b) => b.amount.compare(a.amount))[0];
  if (salaryCandidate && salaryCandidate.category === "other" && !proposals.some((p) => p.kind === "income" && p.category === "salary")) {
    salaryCandidate.category = "salary";
  }

  matchExisting(proposals, input);
  return proposals.sort(
    (a, b) => SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.amount.compare(a.amount),
  );
}

const SOURCE_ORDER: Record<ProposalSource, number> = { recurring: 0, extra: 1, annual: 2, average: 3 };
const KIND_ORDER: Record<ProposalKind, number> = { income: 0, transfer: 1, expense: 2 };

/** Within this, an existing item already says the same thing; beyond it, offer an update. */
const EXISTS_TOLERANCE = 0.02;

const within = (a: Money, b: Money, tolerance: number) => {
  const x = toNumber(a);
  const y = toNumber(b);
  return y > 0 && Math.abs(x / y - 1) <= tolerance;
};

/** Marks loan payments, and items that already exist (or exist with a different amount). */
function matchExisting(proposals: Proposal[], input: DetectionInput): void {
  for (const p of proposals) {
    if (p.kind !== "expense" || p.source === "average") continue;
    const loan = input.loanPayments
      .filter((l) => l.amount.currency === p.amount.currency && within(p.amount, l.amount, 0.015))
      .sort((a, b) => Math.abs(toNumber(a.amount) - toNumber(p.amount)) - Math.abs(toNumber(b.amount) - toNumber(p.amount)))[0];
    if (loan) {
      p.status = "covered_by_loan";
      p.matchId = loan.loanId;
      p.matchAmount = loan.amount;
    } else if (p.occurrences.some((o) => looksLikeLoanPayment(o.description)) && input.loanPayments.length > 0) {
      p.status = "covered_by_loan";
      p.matchId = input.loanPayments[0]!.loanId;
      p.matchAmount = input.loanPayments[0]!.amount;
    }
  }

  const consumed = new Set<string>();
  const byAmount = [...proposals].sort((a, b) => b.amount.compare(a.amount));
  for (const p of byAmount) {
    if (p.status !== "new") continue;
    if (p.kind === "transfer") {
      const candidates = input.existingTransfers.filter(
        (t) => !consumed.has(t.id) && t.fromAccountId === input.accountId && (p.toAccountId === undefined || t.toAccountId === p.toAccountId) && t.frequency === p.frequency,
      );
      const match = closest(candidates, p.amount);
      if (match) {
        consumed.add(match.id);
        p.toAccountId ??= match.toAccountId;
        p.matchId = match.id;
        p.matchAmount = match.amount;
        p.status = within(p.amount, match.amount, EXISTS_TOLERANCE) ? "exists" : "update";
      }
      continue;
    }
    // Same kind and frequency; a close amount matches whatever the category, a looser
    // one only within the same category.
    const candidates = input.existingItems.filter(
      (i) =>
        !consumed.has(i.id) &&
        i.kind === p.kind &&
        i.frequency === p.frequency &&
        (within(p.amount, i.amount, 0.1) || (i.category === p.category && within(p.amount, i.amount, 0.35))),
    );
    const match = closest(candidates, p.amount);
    if (match) {
      consumed.add(match.id);
      p.matchId = match.id;
      p.matchAmount = match.amount;
      p.status = within(p.amount, match.amount, EXISTS_TOLERANCE) ? "exists" : "update";
    }
  }
}

function closest<T extends { amount: Money }>(items: readonly T[], amount: Money): T | undefined {
  return [...items].sort((a, b) => Math.abs(toNumber(a.amount) - toNumber(amount)) - Math.abs(toNumber(b.amount) - toNumber(amount)))[0];
}
