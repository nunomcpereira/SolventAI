import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { ensureSeeded } from "./seed.js";
import {
  createSqliteLoanRepository,
  createSqliteAccountRepository,
  createSqliteContractDocumentRepository,
} from "../db/repositories/index.js";
import { parseLoan, type Loan, type LoanCategory } from "../../domain/loans/loan.js";
import { getLoanSchedule, periodsElapsedBefore } from "./loanService.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { Money, sumMoney } from "../../engine/money/money.js";
import { PERIODS_PER_YEAR, type Frequency } from "../../engine/dates/frequency.js";
import { type AmortizationType, type AmortizationEntry } from "../../engine/amortization/amortization.js";
import { type DayCountConvention } from "../../engine/dayCount/dayCount.js";
import { type Account } from "../../domain/accounts/account.js";
import { type ContractDocument } from "../../domain/contracts/contract.js";

export interface LoanChartPoint {
  label: string;
  interest: string;
  principal: string;
}

export interface LoanSummary {
  loan: Loan;
  /** Principal still owed as of today (loan.principal minus everything paid down so
   * far) — distinct from `loan.principal`, which is the original amount borrowed. */
  outstandingPrincipal: Money;
  monthlyPayment: Money | undefined;
  remainingPeriods: number;
  totalInterestRemaining: Money | undefined;
  rateDataMissing: boolean;
  chartData: LoanChartPoint[] | undefined;
  contractDocumentName?: string;
}

function buildChartData(loan: Loan, schedule: AmortizationEntry[]): LoanChartPoint[] {
  const currency = loan.principal.currency;
  const periodsPerYear = PERIODS_PER_YEAR[loan.paymentFrequency];
  const aggregateYearly = schedule.length > 60 && periodsPerYear > 1;

  if (!aggregateYearly) {
    return schedule.map((entry) => ({
      label: `#${entry.period}`,
      interest: entry.interest.toDecimalString(),
      principal: entry.principal.toDecimalString(),
    }));
  }

  const buckets: LoanChartPoint[] = [];
  for (let start = 0; start < schedule.length; start += periodsPerYear) {
    const yearEntries = schedule.slice(start, start + periodsPerYear);
    const year = Math.floor(start / periodsPerYear) + 1;
    buckets.push({
      label: `Y${year}`,
      interest: sumMoney(currency, yearEntries.map((e) => e.interest)).toDecimalString(),
      principal: sumMoney(currency, yearEntries.map((e) => e.principal)).toDecimalString(),
    });
  }
  return buckets;
}

export async function listLoanSummaries(): Promise<LoanSummary[]> {
  const db = await getDb();
  await ensureSeeded(db);
  const loans = await createSqliteLoanRepository(db).list();
  const contractDocs = await createSqliteContractDocumentRepository(db).list();
  const docMap = new Map(contractDocs.map((d) => [d.id, d.fileName]));

  const today = IsoDate.fromString(new Date().toISOString().slice(0, 10));

  return loans.map((loan) => {
    const contractDocumentName = loan.contractDocumentId ? docMap.get(loan.contractDocumentId) : undefined;
    const fullSchedule = getLoanSchedule(loan);
    // Payoff progress, current payment, and remaining interest are all "as of today" —
    // periods already paid off since loan.startDate must not count as remaining, or a
    // loan that originated in the past always shows 0% progress (its full original
    // schedule) regardless of how much time has actually elapsed.
    const remainingSchedule = fullSchedule.slice(periodsElapsedBefore(loan, today));
    return {
      loan,
      outstandingPrincipal: remainingSchedule[0]?.openingPrincipal ?? Money.zero(loan.principal.currency),
      monthlyPayment: remainingSchedule[0]?.scheduledPayment,
      remainingPeriods: remainingSchedule.length,
      totalInterestRemaining: sumMoney(loan.principal.currency, remainingSchedule.map((e) => e.interest)),
      rateDataMissing: false,
      chartData: buildChartData(loan, remainingSchedule),
      ...(contractDocumentName ? { contractDocumentName } : {}),
    };
  });
}

export async function getAvailableAccountsForLoanSelect(): Promise<Account[]> {
  const db = await getDb();
  await ensureSeeded(db);
  return createSqliteAccountRepository(db).list();
}

export async function getAvailableContractDocumentsForSelect(): Promise<ContractDocument[]> {
  const db = await getDb();
  await ensureSeeded(db);
  return createSqliteContractDocumentRepository(db).list();
}

export interface CreateLoanParams {
  name: string;
  category: LoanCategory;
  principalAmount: string;
  currency: string;
  startDate: string;
  numberOfPeriods: number;
  paymentFrequency: Frequency;
  amortizationType: AmortizationType;
  dayCountConvention?: DayCountConvention;
  rateType?: "fixed" | "variable" | "mixed";
  fixedRate?: string;
  euriborRate?: string;
  spread?: string;
  fixedRatePeriods?: number;
  sourceAccountId: string;
  contractDocumentId?: string;
}

function parseRateValue(raw: string, fallback = "0.04"): string {
  const cleaned = raw.replace(",", ".").replaceAll("%", "").trim();
  const num = Number(cleaned);
  if (isNaN(num) || num < 0) return fallback;
  const decimalVal = num > 1 ? num / 100 : num;
  return decimalVal.toString();
}

function buildLoanRate(
  params: Pick<CreateLoanParams, "rateType" | "fixedRate" | "euriborRate" | "spread" | "fixedRatePeriods">,
):
  | { type: "fixed"; annualRate: string }
  | { type: "variable"; index: string; currentIndexRate: string; spread: string; resetFrequency: Frequency }
  | {
      type: "mixed";
      fixedAnnualRate: string;
      fixedPeriodCount: number;
      index: string;
      currentIndexRate: string;
      spread: string;
      resetFrequency: Frequency;
    } {
  const rateType = params.rateType ?? "fixed";
  const fixedRate = parseRateValue(params.fixedRate ?? "4");
  const euriborRate = parseRateValue(params.euriborRate ?? "2", "0.02");
  const spread = parseRateValue(params.spread ?? "1", "0.01");

  if (rateType === "variable") {
    return {
      type: "variable",
      index: "EURIBOR_6M",
      currentIndexRate: euriborRate,
      spread,
      resetFrequency: "semiannual",
    };
  }

  if (rateType === "mixed") {
    return {
      type: "mixed",
      fixedAnnualRate: fixedRate,
      fixedPeriodCount: Math.max(1, Math.round(Number(params.fixedRatePeriods) || 12)),
      index: "EURIBOR_6M",
      currentIndexRate: euriborRate,
      spread,
      resetFrequency: "semiannual",
    };
  }

  return {
    type: "fixed",
    annualRate: fixedRate,
  };
}

export async function createLoan(params: CreateLoanParams): Promise<Loan> {
  const db = await getDb();
  await ensureSeeded(db);
  const repo = createSqliteLoanRepository(db);

  const principal = Money.fromDecimalString(params.principalAmount || "10000", params.currency || "EUR");
  const rate = buildLoanRate(params);

  const parsed = parseLoan({
    id: `loan-${randomUUID()}`,
    name: params.name.trim() || "New Loan",
    category: params.category || "personal",
    principal: { minorUnits: principal.minorUnits.toString(), currency: principal.currency },
    startDate: params.startDate || new Date().toISOString().slice(0, 10),
    numberOfPeriods: Math.max(1, Math.round(Number(params.numberOfPeriods) || 12)),
    paymentFrequency: params.paymentFrequency || "monthly",
    amortizationType: params.amortizationType || "french",
    dayCountConvention: params.dayCountConvention || "actual/365",
    rate,
    sourceAccountId: params.sourceAccountId,
    fees: [],
    prepaymentPenalty: { type: "none" },
    ...(params.contractDocumentId ? { contractDocumentId: params.contractDocumentId } : {}),
  });

  await repo.save(parsed);
  return parsed;
}

export interface UpdateLoanParams {
  name?: string;
  category?: LoanCategory;
  principalAmount?: string;
  currency?: string;
  startDate?: string;
  numberOfPeriods?: number;
  paymentFrequency?: Frequency;
  amortizationType?: AmortizationType;
  rateType?: "fixed" | "variable" | "mixed";
  fixedRate?: string;
  euriborRate?: string;
  spread?: string;
  fixedRatePeriods?: number;
  sourceAccountId?: string;
  contractDocumentId?: string;
}

export async function updateLoan(id: string, params: UpdateLoanParams): Promise<void> {
  const db = await getDb();
  await ensureSeeded(db);
  const repo = createSqliteLoanRepository(db);
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Loan with ID "${id}" not found.`);

  const currency = params.currency ?? existing.principal.currency;
  const principal = params.principalAmount
    ? Money.fromDecimalString(params.principalAmount, currency)
    : existing.principal;

  const shouldOverrideRate =
    params.rateType !== undefined ||
    params.fixedRate !== undefined ||
    params.euriborRate !== undefined ||
    params.spread !== undefined ||
    params.fixedRatePeriods !== undefined;

  const existingRateParams: Required<Pick<UpdateLoanParams, "rateType" | "fixedRate" | "euriborRate" | "spread" | "fixedRatePeriods">> =
    existing.rate.type === "fixed"
      ? {
          rateType: "fixed",
          fixedRate: existing.rate.annualRate.toString(),
          euriborRate: "0.02",
          spread: "0.01",
          fixedRatePeriods: 12,
        }
      : existing.rate.type === "variable"
        ? {
            rateType: "variable",
            fixedRate: "0.04",
            euriborRate: existing.rate.currentIndexRate.toString(),
            spread: existing.rate.spread.toString(),
            fixedRatePeriods: 12,
          }
        : {
            rateType: "mixed",
            fixedRate: existing.rate.fixedAnnualRate.toString(),
            euriborRate: existing.rate.currentIndexRate.toString(),
            spread: existing.rate.spread.toString(),
            fixedRatePeriods: existing.rate.fixedPeriodCount,
          };

  const rate = shouldOverrideRate
    ? buildLoanRate({
        rateType: params.rateType ?? existingRateParams.rateType,
        fixedRate: params.fixedRate ?? existingRateParams.fixedRate,
        euriborRate: params.euriborRate ?? existingRateParams.euriborRate,
        spread: params.spread ?? existingRateParams.spread,
        fixedRatePeriods: params.fixedRatePeriods ?? existingRateParams.fixedRatePeriods,
      })
    : existing.rate.type === "fixed"
      ? { type: "fixed" as const, annualRate: existing.rate.annualRate.toString() }
      : existing.rate.type === "variable"
        ? {
            type: "variable" as const,
            index: existing.rate.index,
            currentIndexRate: existing.rate.currentIndexRate.toString(),
            spread: existing.rate.spread.toString(),
            resetFrequency: existing.rate.resetFrequency,
          }
        : {
            type: "mixed" as const,
            fixedAnnualRate: existing.rate.fixedAnnualRate.toString(),
            fixedPeriodCount: existing.rate.fixedPeriodCount,
            index: existing.rate.index,
            currentIndexRate: existing.rate.currentIndexRate.toString(),
            spread: existing.rate.spread.toString(),
            resetFrequency: existing.rate.resetFrequency,
          };

  const parsed = parseLoan({
    id: existing.id,
    name: params.name?.trim() || existing.name,
    category: params.category || existing.category,
    principal: { minorUnits: principal.minorUnits.toString(), currency: principal.currency },
    startDate: params.startDate || existing.startDate.toString(),
    numberOfPeriods: params.numberOfPeriods
      ? Math.max(1, Math.round(Number(params.numberOfPeriods)))
      : existing.numberOfPeriods,
    paymentFrequency: params.paymentFrequency || existing.paymentFrequency,
    amortizationType: params.amortizationType || existing.amortizationType,
    dayCountConvention: existing.dayCountConvention,
    rate,
    sourceAccountId: params.sourceAccountId || existing.sourceAccountId,
    fees: existing.fees.map((f) => ({
      id: f.id,
      description: f.description,
      amount: { minorUnits: f.amount.minorUnits.toString(), currency: f.amount.currency },
      timing: f.timing,
    })),
    prepaymentPenalty:
      existing.prepaymentPenalty.type === "none"
        ? { type: "none" }
        : existing.prepaymentPenalty.type === "percentage"
          ? {
              type: "percentage",
              rate: existing.prepaymentPenalty.rate.toString(),
              ...(existing.prepaymentPenalty.maximumPenalty
                ? {
                    maximumPenalty: {
                      minorUnits: existing.prepaymentPenalty.maximumPenalty.minorUnits.toString(),
                      currency: existing.prepaymentPenalty.maximumPenalty.currency,
                    },
                  }
                : {}),
            }
          : {
              type: "fixed",
              fixedAmount: {
                minorUnits: existing.prepaymentPenalty.fixedAmount.minorUnits.toString(),
                currency: existing.prepaymentPenalty.fixedAmount.currency,
              },
            },
    ...(params.contractDocumentId !== undefined
      ? params.contractDocumentId
        ? { contractDocumentId: params.contractDocumentId }
        : {}
      : existing.contractDocumentId
        ? { contractDocumentId: existing.contractDocumentId }
        : {}),
  });

  await repo.save(parsed);
}

export async function deleteLoan(id: string): Promise<void> {
  const db = await getDb();
  await ensureSeeded(db);
  await createSqliteLoanRepository(db).delete(id);
}

