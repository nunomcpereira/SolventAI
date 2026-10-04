import { type Database } from "../client.js";
import {
  type ExchangeRate,
  type ExchangeRateRepository,
  parseExchangeRate,
  serializeExchangeRate,
} from "../../../domain/exchangeRates/exchangeRate.js";

interface ExchangeRateRow {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: string;
  effective_date: string;
}

function rowToExchangeRate(row: ExchangeRateRow): ExchangeRate {
  return parseExchangeRate({
    id: row.id,
    fromCurrency: row.from_currency,
    toCurrency: row.to_currency,
    rate: row.rate,
    effectiveDate: row.effective_date,
  });
}

export function createSqliteExchangeRateRepository(db: Database): ExchangeRateRepository {
  return {
    async findById(id: string): Promise<ExchangeRate | undefined> {
      const row = db.prepare("SELECT * FROM exchange_rates WHERE id = ?").get(id) as ExchangeRateRow | undefined;
      return row ? rowToExchangeRate(row) : undefined;
    },

    async list(): Promise<ExchangeRate[]> {
      const rows = db.prepare("SELECT * FROM exchange_rates ORDER BY effective_date").all() as unknown as ExchangeRateRow[];
      return rows.map(rowToExchangeRate);
    },

    async save(rate: ExchangeRate): Promise<void> {
      const s = serializeExchangeRate(rate);
      db.prepare(
        `INSERT INTO exchange_rates (id, from_currency, to_currency, rate, effective_date)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           from_currency = excluded.from_currency,
           to_currency = excluded.to_currency,
           rate = excluded.rate,
           effective_date = excluded.effective_date`,
      ).run(s.id, s.fromCurrency, s.toCurrency, s.rate, s.effectiveDate);
    },

    async delete(id: string): Promise<void> {
      db.prepare("DELETE FROM exchange_rates WHERE id = ?").run(id);
    },
  };
}
