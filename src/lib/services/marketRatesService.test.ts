import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

vi.hoisted(() => {
  process.env["SOLVENT_DB_PATH"] = ":memory:";
});
vi.mock("server-only", () => ({}));
vi.mock("./seed.js", () => ({ ensureSeeded: async () => {} }));

import { getDb } from "./db.js";
import { applyCurrentEuriborToLoans } from "./marketRatesService.js";
import { createSqliteLoanRepository } from "../db/repositories/index.js";
import { parseLoan } from "../../domain/loans/loan.js";

const table = readFileSync(fileURLToPath(new URL("../marketRates/fixtures/euribor-table.html", import.meta.url)), "utf-8");
const fakeFetch = (async () => new Response(table, { status: 200 })) as unknown as typeof fetch;

function loan(id: string, rate: Record<string, unknown>) {
  return parseLoan({
    id,
    name: `Loan ${id}`,
    category: "mortgage",
    principal: { minorUnits: "20000000", currency: "EUR" },
    startDate: "2024-07-07",
    numberOfPeriods: 405,
    paymentFrequency: "monthly",
    amortizationType: "french",
    dayCountConvention: "actual/360",
    rate,
    sourceAccountId: "acc-1",
    fees: [],
    prepaymentPenalty: { type: "none" },
  });
}

beforeEach(async () => {
  const db = await getDb();
  db.exec("PRAGMA foreign_keys = OFF; DELETE FROM loans;");
});

describe("applyCurrentEuriborToLoans", () => {
  it("updates only the index rate of Euribor-linked loans, keeping index name, spread and fixed leg", async () => {
    const db = await getDb();
    const repo = createSqliteLoanRepository(db);
    await repo.save(
      loan("mixed", {
        type: "mixed",
        fixedAnnualRate: "0.03",
        fixedPeriodCount: 36,
        index: "Euribor a 6 meses",
        currentIndexRate: "0.022",
        spread: "0.007",
        resetFrequency: "semiannual",
      }),
    );
    await repo.save(
      loan("variable", { type: "variable", index: "EURIBOR_12M", currentIndexRate: "0.025", spread: "0.01", resetFrequency: "annual" }),
    );
    await repo.save(loan("fixed", { type: "fixed", annualRate: "0.04" }));

    const result = await applyCurrentEuriborToLoans(fakeFetch);

    expect(result.asOf).toBe("2026-11-06");
    expect(result.updated.map((u) => [u.loanId, u.tenor, u.newRate])).toEqual([
      ["mixed", "6M", "0.03016"],
      ["variable", "12M", "0.03248"],
    ]);

    const mixed = await repo.findById("mixed");
    expect(mixed?.rate.type).toBe("mixed");
    if (mixed?.rate.type === "mixed") {
      expect(mixed.rate.currentIndexRate.toString()).toBe("0.03016");
      expect(mixed.rate.index).toBe("Euribor a 6 meses");
      expect(mixed.rate.spread.toString()).toBe("0.007");
      expect(mixed.rate.fixedAnnualRate.toString()).toBe("0.03");
    }
    const fixed = await repo.findById("fixed");
    expect(fixed?.rate).toEqual(loan("fixed", { type: "fixed", annualRate: "0.04" }).rate);
  });

  it("counts loans already at the published rate as unchanged, and reports unknown tenors", async () => {
    const db = await getDb();
    const repo = createSqliteLoanRepository(db);
    await repo.save(
      loan("current", { type: "variable", index: "EURIBOR_3M", currentIndexRate: "0.02794", spread: "0.01", resetFrequency: "quarterly" }),
    );
    await repo.save(
      loan("odd", { type: "variable", index: "Euribor 9 months", currentIndexRate: "0.02", spread: "0.01", resetFrequency: "quarterly" }),
    );
    await repo.save(loan("sofr", { type: "variable", index: "SOFR", currentIndexRate: "0.05", spread: "0.01", resetFrequency: "monthly" }));

    const result = await applyCurrentEuriborToLoans(fakeFetch);
    expect(result.updated).toEqual([]);
    expect(result.unchanged).toBe(1);
    expect(result.unmatched).toEqual([{ loanName: "Loan odd", index: "Euribor 9 months" }]);
  });

  it("changes nothing when the source can't be read", async () => {
    const db = await getDb();
    const repo = createSqliteLoanRepository(db);
    await repo.save(
      loan("v", { type: "variable", index: "EURIBOR_6M", currentIndexRate: "0.02", spread: "0.01", resetFrequency: "semiannual" }),
    );
    const down = (async () => new Response("busy", { status: 503 })) as unknown as typeof fetch;
    await expect(applyCurrentEuriborToLoans(down)).rejects.toThrow(/HTTP 503/);
    const v = await repo.findById("v");
    expect(v?.rate.type === "variable" && v.rate.currentIndexRate.toString()).toBe("0.02");
  });
});
