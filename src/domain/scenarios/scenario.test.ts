import { describe, expect, it } from "vitest";
import { parseScenario, serializeScenario } from "./scenario.js";
import { DomainValidationError } from "../shared/errors.js";

function validRaw() {
  return {
    id: "scn-1",
    name: "Income shock",
    events: [
      {
        id: "e1",
        date: "2026-06-01",
        payload: { type: "income_change", incomeId: "inc-1", newAmount: { minorUnits: "300000", currency: "EUR" } },
      },
      {
        id: "e2",
        date: "2026-07-01",
        payload: {
          type: "prepayment",
          loanId: "loan-1",
          sourceAccountId: "acc-1",
          amount: { minorUnits: "500000", currency: "EUR" },
          strategy: "shorten_term",
        },
      },
    ],
  };
}

describe("parseScenario", () => {
  it("parses events with engine-typed Money/Decimal/IsoDate fields", () => {
    const scenario = parseScenario(validRaw());
    expect(scenario.events).toHaveLength(2);
    const incomeChange = scenario.events[0]!;
    expect(incomeChange.date.toString()).toBe("2026-06-01");
    if (incomeChange.payload.type === "income_change") {
      expect(incomeChange.payload.newAmount.toDecimalString()).toBe("3000.00");
    }
  });

  it("round-trips through serializeScenario for every event payload type", () => {
    const scenario = parseScenario(validRaw());
    expect(parseScenario(serializeScenario(scenario))).toEqual(scenario);
  });

  it("round-trips an optional income_change endDate", () => {
    const raw = validRaw();
    raw.events[0]!.payload = { ...raw.events[0]!.payload, endDate: "2026-12-31" } as never;
    const scenario = parseScenario(raw);
    const payload = scenario.events[0]!.payload;
    expect(payload.type === "income_change" ? payload.endDate?.toString() : undefined).toBe("2026-12-31");
    expect(serializeScenario(scenario).events[0]!.payload).toMatchObject({ endDate: "2026-12-31" });
  });

  it("rejects an unknown event payload type", () => {
    const raw = validRaw();
    raw.events[0]!.payload = { type: "unknown_event", foo: "bar" } as never;
    expect(() => parseScenario(raw)).toThrow(DomainValidationError);
  });

  it("rejects a malformed money field within a payload", () => {
    const raw = validRaw();
    (raw.events[0]!.payload as { newAmount: unknown }).newAmount = { minorUnits: "abc", currency: "EUR" };
    expect(() => parseScenario(raw)).toThrow(DomainValidationError);
  });

  it("accepts an optional baseScenarioId", () => {
    const scenario = parseScenario({ ...validRaw(), baseScenarioId: "base" });
    expect(scenario.baseScenarioId).toBe("base");
  });
});
