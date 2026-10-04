import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import { createSqliteExchangeRateRepository } from "./sqliteExchangeRateRepository.js";
import { createSqliteSettingsRepository } from "./sqliteSettingsRepository.js";
import { parseExchangeRate } from "../../../domain/exchangeRates/exchangeRate.js";
import { DEFAULT_SETTINGS } from "../../../domain/settings/settings.js";

describe("SqliteExchangeRateRepository", () => {
  it("round-trips a rate exactly", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteExchangeRateRepository(db);
    const rate = parseExchangeRate({
      id: "fx-1",
      fromCurrency: "USD",
      toCurrency: "EUR",
      rate: "0.92",
      effectiveDate: "2026-01-01",
    });
    await repo.save(rate);
    expect(await repo.findById("fx-1")).toEqual(rate);
  });

  it("list orders by effectiveDate", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteExchangeRateRepository(db);
    await repo.save(parseExchangeRate({ id: "fx-2", fromCurrency: "USD", toCurrency: "EUR", rate: "0.95", effectiveDate: "2026-06-01" }));
    await repo.save(parseExchangeRate({ id: "fx-1", fromCurrency: "USD", toCurrency: "EUR", rate: "0.90", effectiveDate: "2026-01-01" }));
    const all = await repo.list();
    expect(all.map((r) => r.id)).toEqual(["fx-1", "fx-2"]);
  });
});

describe("SqliteSettingsRepository", () => {
  it("returns undefined before any settings are saved", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteSettingsRepository(db);
    expect(await repo.get()).toBeUndefined();
  });

  it("saves and retrieves settings, upserting the singleton row", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteSettingsRepository(db);
    await repo.save(DEFAULT_SETTINGS);
    expect(await repo.get()).toEqual(DEFAULT_SETTINGS);

    const updated = { ...DEFAULT_SETTINGS, baseCurrency: "USD", language: "pt" as const };
    await repo.save(updated);
    expect(await repo.get()).toEqual(updated);
  });
});
