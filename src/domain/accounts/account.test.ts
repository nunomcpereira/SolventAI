import { describe, expect, it } from "vitest";
import { Money } from "../../engine/money/money.js";
import { parseAccount, serializeAccount } from "./account.js";
import { DomainValidationError } from "../shared/errors.js";

function validRaw() {
  return {
    id: "acc-1",
    name: "Main Checking",
    type: "checking",
    currency: "EUR",
    initialBalance: { minorUnits: "150000", currency: "EUR" },
    minimumReserve: { minorUnits: "50000", currency: "EUR" },
    active: true,
  };
}

describe("parseAccount", () => {
  it("parses valid input into a domain Account with engine Money", () => {
    const account = parseAccount(validRaw());
    expect(account.initialBalance.equals(Money.fromDecimalString("1500.00", "EUR"))).toBe(true);
    expect(account.minimumReserve.equals(Money.fromDecimalString("500.00", "EUR"))).toBe(true);
  });

  it("round-trips through serializeAccount", () => {
    const account = parseAccount(validRaw());
    const serialized = serializeAccount(account);
    const reparsed = parseAccount(serialized);
    expect(reparsed).toEqual(account);
  });

  it("rejects empty name", () => {
    expect(() => parseAccount({ ...validRaw(), name: "  " })).toThrow(DomainValidationError);
  });

  it("rejects invalid account type", () => {
    expect(() => parseAccount({ ...validRaw(), type: "crypto" })).toThrow(DomainValidationError);
  });

  it("rejects negative minimumReserve", () => {
    expect(() =>
      parseAccount({ ...validRaw(), minimumReserve: { minorUnits: "-1", currency: "EUR" } }),
    ).toThrow(DomainValidationError);
  });

  it("rejects initialBalance currency mismatch with account currency", () => {
    expect(() =>
      parseAccount({ ...validRaw(), initialBalance: { minorUnits: "100", currency: "USD" } }),
    ).toThrow(DomainValidationError);
  });

  it("allows negative initialBalance (already-overdrawn import)", () => {
    const account = parseAccount({ ...validRaw(), initialBalance: { minorUnits: "-100", currency: "EUR" } });
    expect(account.initialBalance.isNegative()).toBe(true);
  });
});
