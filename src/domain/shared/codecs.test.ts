import { describe, expect, it } from "vitest";
import { Money } from "../../engine/money/money.js";
import { Decimal } from "../../engine/money/decimal.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import {
  moneySchema,
  moneyToSerialized,
  moneyFromSerialized,
  isoDateSchema,
  isoDateToSerialized,
  isoDateFromSerialized,
  decimalSchema,
  decimalToSerialized,
  decimalFromSerialized,
  currencyCodeSchema,
} from "./codecs.js";

describe("money codec", () => {
  it("round-trips exactly through serialization", () => {
    const money = Money.fromDecimalString("1234.56", "EUR");
    const serialized = moneyToSerialized(money);
    expect(moneySchema.safeParse(serialized).success).toBe(true);
    expect(moneyFromSerialized(serialized).equals(money)).toBe(true);
  });

  it("rejects non-integer minorUnits", () => {
    expect(moneySchema.safeParse({ minorUnits: "12.5", currency: "EUR" }).success).toBe(false);
  });

  it("rejects unknown currency", () => {
    expect(moneySchema.safeParse({ minorUnits: "100", currency: "XXX" }).success).toBe(false);
  });

  it("uppercases lowercase currency codes", () => {
    const result = currencyCodeSchema.safeParse("eur");
    expect(result.success && result.data).toBe("EUR");
  });
});

describe("isoDate codec", () => {
  it("round-trips exactly", () => {
    const date = IsoDate.fromString("2026-08-09");
    const serialized = isoDateToSerialized(date);
    expect(isoDateSchema.safeParse(serialized).success).toBe(true);
    expect(isoDateFromSerialized(serialized).equals(date)).toBe(true);
  });

  it("rejects malformed or invalid calendar dates", () => {
    expect(isoDateSchema.safeParse("2026-8-9").success).toBe(false);
    expect(isoDateSchema.safeParse("2026-02-30").success).toBe(false);
  });
});

describe("decimal codec", () => {
  it("round-trips exactly", () => {
    const decimal = Decimal.fromString("0.035");
    const serialized = decimalToSerialized(decimal);
    expect(decimalSchema.safeParse(serialized).success).toBe(true);
    expect(decimalFromSerialized(serialized).compare(decimal)).toBe(0);
  });

  it("rejects non-decimal-literal strings", () => {
    expect(decimalSchema.safeParse("1e10").success).toBe(false);
    expect(decimalSchema.safeParse("abc").success).toBe(false);
  });
});
