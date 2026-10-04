import { z } from "zod";
import { type Scenario } from "../../engine/simulation/scenario.js";
import { type SimulationEvent, type SimulationEventPayload } from "../../engine/simulation/events.js";
import {
  moneySchema,
  decimalSchema,
  isoDateSchema,
  moneyToSerialized,
  moneyFromSerialized,
  decimalToSerialized,
  decimalFromSerialized,
  isoDateToSerialized,
  isoDateFromSerialized,
  DomainValidationError,
  type Repository,
} from "../shared/index.js";

const strategySchema = z.enum(["reduce_payment", "shorten_term"]);

const serializedPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("balance_override"), accountId: z.string(), newBalance: moneySchema }),
  z.object({ type: z.literal("rate_change"), loanId: z.string(), index: z.string(), newAnnualValue: decimalSchema }),
  z.object({ type: z.literal("income_change"), incomeId: z.string(), newAmount: moneySchema, endDate: isoDateSchema.optional() }),
  z.object({ type: z.literal("expense_change"), expenseId: z.string(), newAmount: moneySchema, endDate: isoDateSchema.optional() }),
  z.object({ type: z.literal("one_time_income"), accountId: z.string(), amount: moneySchema, description: z.string().optional() }),
  z.object({
    type: z.literal("account_transfer"),
    fromAccountId: z.string(),
    toAccountId: z.string(),
    amount: moneySchema,
    creditedAmount: moneySchema,
  }),
  z.object({ type: z.literal("prepayment"), loanId: z.string(), sourceAccountId: z.string(), amount: moneySchema, strategy: strategySchema }),
  z.object({ type: z.literal("one_time_expense"), accountId: z.string(), amount: moneySchema, description: z.string().optional() }),
]);
export type SerializedEventPayload = z.infer<typeof serializedPayloadSchema>;

const serializedEventSchema = z.object({
  id: z.string().min(1),
  date: isoDateSchema,
  payload: serializedPayloadSchema,
});

export const scenarioInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  baseScenarioId: z.string().optional(),
  events: z.array(serializedEventSchema),
});
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;

export interface ScenarioRepository extends Repository<Scenario> {}

function payloadFromSerialized(raw: SerializedEventPayload): SimulationEventPayload {
  switch (raw.type) {
    case "balance_override":
      return { type: "balance_override", accountId: raw.accountId, newBalance: moneyFromSerialized(raw.newBalance) };
    case "rate_change":
      return { type: "rate_change", loanId: raw.loanId, index: raw.index, newAnnualValue: decimalFromSerialized(raw.newAnnualValue) };
    case "income_change":
      return {
        type: "income_change",
        incomeId: raw.incomeId,
        newAmount: moneyFromSerialized(raw.newAmount),
        ...(raw.endDate !== undefined ? { endDate: isoDateFromSerialized(raw.endDate) } : {}),
      };
    case "expense_change":
      return {
        type: "expense_change",
        expenseId: raw.expenseId,
        newAmount: moneyFromSerialized(raw.newAmount),
        ...(raw.endDate !== undefined ? { endDate: isoDateFromSerialized(raw.endDate) } : {}),
      };
    case "one_time_income":
      return {
        type: "one_time_income",
        accountId: raw.accountId,
        amount: moneyFromSerialized(raw.amount),
        ...(raw.description !== undefined ? { description: raw.description } : {}),
      };
    case "account_transfer":
      return {
        type: "account_transfer",
        fromAccountId: raw.fromAccountId,
        toAccountId: raw.toAccountId,
        amount: moneyFromSerialized(raw.amount),
        creditedAmount: moneyFromSerialized(raw.creditedAmount),
      };
    case "prepayment":
      return {
        type: "prepayment",
        loanId: raw.loanId,
        sourceAccountId: raw.sourceAccountId,
        amount: moneyFromSerialized(raw.amount),
        strategy: raw.strategy,
      };
    case "one_time_expense":
      return {
        type: "one_time_expense",
        accountId: raw.accountId,
        amount: moneyFromSerialized(raw.amount),
        ...(raw.description !== undefined ? { description: raw.description } : {}),
      };
    default: {
      const exhaustive: never = raw;
      throw new Error(`Unhandled serialized event payload: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function payloadToSerialized(payload: SimulationEventPayload): SerializedEventPayload {
  switch (payload.type) {
    case "balance_override":
      return { type: "balance_override", accountId: payload.accountId, newBalance: moneyToSerialized(payload.newBalance) };
    case "rate_change":
      return { type: "rate_change", loanId: payload.loanId, index: payload.index, newAnnualValue: decimalToSerialized(payload.newAnnualValue) };
    case "income_change":
      return {
        type: "income_change",
        incomeId: payload.incomeId,
        newAmount: moneyToSerialized(payload.newAmount),
        ...(payload.endDate !== undefined ? { endDate: isoDateToSerialized(payload.endDate) } : {}),
      };
    case "expense_change":
      return {
        type: "expense_change",
        expenseId: payload.expenseId,
        newAmount: moneyToSerialized(payload.newAmount),
        ...(payload.endDate !== undefined ? { endDate: isoDateToSerialized(payload.endDate) } : {}),
      };
    case "one_time_income":
      return {
        type: "one_time_income",
        accountId: payload.accountId,
        amount: moneyToSerialized(payload.amount),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
      };
    case "account_transfer":
      return {
        type: "account_transfer",
        fromAccountId: payload.fromAccountId,
        toAccountId: payload.toAccountId,
        amount: moneyToSerialized(payload.amount),
        creditedAmount: moneyToSerialized(payload.creditedAmount),
      };
    case "prepayment":
      return {
        type: "prepayment",
        loanId: payload.loanId,
        sourceAccountId: payload.sourceAccountId,
        amount: moneyToSerialized(payload.amount),
        strategy: payload.strategy,
      };
    case "one_time_expense":
      return {
        type: "one_time_expense",
        accountId: payload.accountId,
        amount: moneyToSerialized(payload.amount),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
      };
    default: {
      const exhaustive: never = payload;
      throw new Error(`Unhandled event payload: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function parseScenario(raw: unknown): Scenario {
  const result = scenarioInputSchema.safeParse(raw);
  if (!result.success) throw new DomainValidationError("Scenario", result.error);
  const input = result.data;
  const events: SimulationEvent[] = input.events.map((e) => ({
    id: e.id,
    date: isoDateFromSerialized(e.date),
    payload: payloadFromSerialized(e.payload),
  }));
  return {
    id: input.id,
    name: input.name,
    ...(input.baseScenarioId !== undefined ? { baseScenarioId: input.baseScenarioId } : {}),
    events,
  };
}

export function serializeScenario(scenario: Scenario): ScenarioInput {
  return {
    id: scenario.id,
    name: scenario.name,
    ...(scenario.baseScenarioId !== undefined ? { baseScenarioId: scenario.baseScenarioId } : {}),
    events: scenario.events.map((e) => ({
      id: e.id,
      date: isoDateToSerialized(e.date),
      payload: payloadToSerialized(e.payload),
    })),
  };
}

export { type Scenario, type SimulationEvent };
