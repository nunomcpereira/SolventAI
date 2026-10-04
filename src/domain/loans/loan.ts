import { z } from "zod";
import { Money } from "../../engine/money/money.js";
import { Decimal } from "../../engine/money/decimal.js";
import { type Frequency } from "../../engine/dates/frequency.js";
import { type DayCountConvention } from "../../engine/dayCount/dayCount.js";
import { type AmortizationType } from "../../engine/amortization/amortization.js";
import { type Rate, type FixedRate, type VariableRate, type MixedRate } from "../../engine/rates/rate.js";
import { type PrepaymentPenaltyRule } from "../../engine/prepayment/penalty.js";
import {
  moneySchema,
  moneyToSerialized,
  moneyFromSerialized,
  decimalSchema,
  decimalToSerialized,
  decimalFromSerialized,
  isoDateSchema,
  isoDateToSerialized,
  isoDateFromSerialized,
  type SerializedMoney,
  type SerializedDecimal,
  type SerializedIsoDate,
  DomainValidationError,
  type Repository,
} from "../shared/index.js";
import { IsoDate } from "../../engine/dates/isoDate.js";

export const DEFAULT_LOAN_CATEGORIES = ["mortgage", "auto", "personal", "consumer", "student", "other"] as const;
export type LoanCategory = string;

export interface LoanFee {
  id: string;
  description: string;
  amount: Money;
  /** "origination" charges once at period 0; "per_period" charges every scheduled period. */
  timing: "origination" | "per_period";
}

export type { PrepaymentPenaltyRule };

export interface Loan {
  id: string;
  name: string;
  category: LoanCategory;
  principal: Money;
  startDate: IsoDate;
  numberOfPeriods: number;
  paymentFrequency: Frequency;
  amortizationType: AmortizationType;
  dayCountConvention: DayCountConvention;
  rate: Rate;
  /** Account from which scheduled payments are debited. */
  sourceAccountId: string;
  fees: LoanFee[];
  prepaymentPenalty: PrepaymentPenaltyRule;
  contractDocumentId?: string;
}

export interface LoanRepository extends Repository<Loan> {}

const loanCategorySchema = z.string().trim().min(1);
export const frequencySchema = z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"]);
export const amortizationTypeSchema = z.enum(["french", "constant_amortization", "interest_only"]);
export const dayCountConventionSchema = z.enum(["actual/360", "actual/365", "30/360"]);

const serializedFixedRateSchema = z.object({
  type: z.literal("fixed"),
  annualRate: decimalSchema,
});
const serializedVariableRateSchema = z.object({
  type: z.literal("variable"),
  index: z.string().min(1),
  currentIndexRate: decimalSchema,
  spread: decimalSchema,
  resetFrequency: frequencySchema,
  rateCap: decimalSchema.optional(),
  rateFloor: decimalSchema.optional(),
});
const serializedMixedRateSchema = z.object({
  type: z.literal("mixed"),
  fixedAnnualRate: decimalSchema,
  fixedPeriodCount: z.number().int().positive(),
  index: z.string().min(1),
  currentIndexRate: decimalSchema,
  spread: decimalSchema,
  resetFrequency: frequencySchema,
  rateCap: decimalSchema.optional(),
  rateFloor: decimalSchema.optional(),
});
const serializedRateSchema = z.discriminatedUnion("type", [
  serializedFixedRateSchema,
  serializedVariableRateSchema,
  serializedMixedRateSchema,
]);
export type SerializedRate = z.infer<typeof serializedRateSchema>;

/** The index-linked fields ("variable" and "mixed" rates both float against an
 * external index once their fixed leg, if any, ends) shared between rateFromSerialized's
 * two non-fixed branches. */
function variableIndexFieldsFromSerialized(value: {
  index: string;
  currentIndexRate: SerializedDecimal;
  spread: SerializedDecimal;
  resetFrequency: Frequency;
  rateCap?: SerializedDecimal | undefined;
  rateFloor?: SerializedDecimal | undefined;
}) {
  return {
    index: value.index,
    currentIndexRate: decimalFromSerialized(value.currentIndexRate),
    spread: decimalFromSerialized(value.spread),
    resetFrequency: value.resetFrequency,
    ...(value.rateCap !== undefined ? { rateCap: decimalFromSerialized(value.rateCap) } : {}),
    ...(value.rateFloor !== undefined ? { rateFloor: decimalFromSerialized(value.rateFloor) } : {}),
  };
}

function rateFromSerialized(value: SerializedRate): Rate {
  if (value.type === "fixed") {
    const rate: FixedRate = { type: "fixed", annualRate: decimalFromSerialized(value.annualRate) };
    return rate;
  }
  if (value.type === "variable") {
    const rate: VariableRate = { type: "variable", ...variableIndexFieldsFromSerialized(value) };
    return rate;
  }
  const mixedRate: MixedRate = {
    type: "mixed",
    fixedAnnualRate: decimalFromSerialized(value.fixedAnnualRate),
    fixedPeriodCount: value.fixedPeriodCount,
    ...variableIndexFieldsFromSerialized(value),
  };
  return mixedRate;
}

/** See variableIndexFieldsFromSerialized — the same shared fields, the other direction. */
function variableIndexFieldsToSerialized(rate: {
  index: string;
  currentIndexRate: Decimal;
  spread: Decimal;
  resetFrequency: Frequency;
  rateCap?: Decimal;
  rateFloor?: Decimal;
}) {
  return {
    index: rate.index,
    currentIndexRate: decimalToSerialized(rate.currentIndexRate),
    spread: decimalToSerialized(rate.spread),
    resetFrequency: rate.resetFrequency,
    ...(rate.rateCap !== undefined ? { rateCap: decimalToSerialized(rate.rateCap) } : {}),
    ...(rate.rateFloor !== undefined ? { rateFloor: decimalToSerialized(rate.rateFloor) } : {}),
  };
}

function rateToSerialized(rate: Rate): SerializedRate {
  if (rate.type === "fixed") {
    return { type: "fixed", annualRate: decimalToSerialized(rate.annualRate) };
  }
  if (rate.type === "mixed") {
    return {
      type: "mixed",
      fixedAnnualRate: decimalToSerialized(rate.fixedAnnualRate),
      fixedPeriodCount: rate.fixedPeriodCount,
      ...variableIndexFieldsToSerialized(rate),
    };
  }
  return { type: "variable", ...variableIndexFieldsToSerialized(rate) };
}

const serializedLoanFeeSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(1),
  amount: moneySchema,
  timing: z.enum(["origination", "per_period"]),
});

const serializedPrepaymentPenaltySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("percentage"), rate: decimalSchema, maximumPenalty: moneySchema.optional() }),
  z.object({ type: z.literal("fixed"), fixedAmount: moneySchema }),
]);
export type SerializedPrepaymentPenalty = z.infer<typeof serializedPrepaymentPenaltySchema>;

function prepaymentPenaltyFromSerialized(value: SerializedPrepaymentPenalty): PrepaymentPenaltyRule {
  if (value.type === "none") return { type: "none" };
  if (value.type === "percentage") {
    return {
      type: "percentage",
      rate: decimalFromSerialized(value.rate),
      ...(value.maximumPenalty !== undefined ? { maximumPenalty: moneyFromSerialized(value.maximumPenalty) } : {}),
    };
  }
  return { type: "fixed", fixedAmount: moneyFromSerialized(value.fixedAmount) };
}

function prepaymentPenaltyToSerialized(rule: PrepaymentPenaltyRule): SerializedPrepaymentPenalty {
  if (rule.type === "none") return { type: "none" };
  if (rule.type === "percentage") {
    return {
      type: "percentage",
      rate: decimalToSerialized(rule.rate),
      ...(rule.maximumPenalty !== undefined ? { maximumPenalty: moneyToSerialized(rule.maximumPenalty) } : {}),
    };
  }
  return { type: "fixed", fixedAmount: moneyToSerialized(rule.fixedAmount) };
}

export const loanInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  category: loanCategorySchema,
  principal: moneySchema,
  startDate: isoDateSchema,
  numberOfPeriods: z.number().int().positive(),
  paymentFrequency: frequencySchema,
  amortizationType: amortizationTypeSchema,
  dayCountConvention: dayCountConventionSchema,
  rate: serializedRateSchema,
  sourceAccountId: z.string().min(1),
  fees: z.array(serializedLoanFeeSchema),
  prepaymentPenalty: serializedPrepaymentPenaltySchema,
  contractDocumentId: z.string().optional(),
});
export type LoanInput = z.infer<typeof loanInputSchema>;

export interface SerializedLoan {
  id: string;
  name: string;
  category: LoanCategory;
  principal: SerializedMoney;
  startDate: SerializedIsoDate;
  numberOfPeriods: number;
  paymentFrequency: Frequency;
  amortizationType: AmortizationType;
  dayCountConvention: DayCountConvention;
  rate: SerializedRate;
  sourceAccountId: string;
  fees: { id: string; description: string; amount: SerializedMoney; timing: "origination" | "per_period" }[];
  prepaymentPenalty: SerializedPrepaymentPenalty;
  contractDocumentId?: string;
}

export function parseLoan(raw: unknown): Loan {
  const result = loanInputSchema.safeParse(raw);
  if (!result.success) {
    throw new DomainValidationError("Loan", result.error);
  }
  const input = result.data;

  const principal = moneyFromSerialized(input.principal);
  if (!principal.isPositive()) {
    throw new DomainValidationError(
      "Loan",
      new z.ZodError([{ code: "custom", path: ["principal"], message: "must be positive" }]),
    );
  }

  return {
    id: input.id,
    name: input.name,
    category: input.category,
    principal,
    startDate: isoDateFromSerialized(input.startDate),
    numberOfPeriods: input.numberOfPeriods,
    paymentFrequency: input.paymentFrequency,
    amortizationType: input.amortizationType,
    dayCountConvention: input.dayCountConvention,
    rate: rateFromSerialized(input.rate),
    sourceAccountId: input.sourceAccountId,
    fees: input.fees.map((f) => ({
      id: f.id,
      description: f.description,
      amount: moneyFromSerialized(f.amount),
      timing: f.timing,
    })),
    prepaymentPenalty: prepaymentPenaltyFromSerialized(input.prepaymentPenalty),
    ...(input.contractDocumentId ? { contractDocumentId: input.contractDocumentId } : {}),
  };
}

export function serializeLoan(loan: Loan): SerializedLoan {
  return {
    id: loan.id,
    name: loan.name,
    category: loan.category,
    principal: moneyToSerialized(loan.principal),
    startDate: isoDateToSerialized(loan.startDate),
    numberOfPeriods: loan.numberOfPeriods,
    paymentFrequency: loan.paymentFrequency,
    amortizationType: loan.amortizationType,
    dayCountConvention: loan.dayCountConvention,
    rate: rateToSerialized(loan.rate),
    sourceAccountId: loan.sourceAccountId,
    fees: loan.fees.map((f) => ({
      id: f.id,
      description: f.description,
      amount: moneyToSerialized(f.amount),
      timing: f.timing,
    })),
    prepaymentPenalty: prepaymentPenaltyToSerialized(loan.prepaymentPenalty),
    ...(loan.contractDocumentId !== undefined ? { contractDocumentId: loan.contractDocumentId } : {}),
  };
}

