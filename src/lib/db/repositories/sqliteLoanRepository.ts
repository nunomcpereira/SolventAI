import { type Database } from "../client.js";
import {
  type Loan,
  type LoanRepository,
  type SerializedLoan,
  type SerializedRate,
  type SerializedPrepaymentPenalty,
  parseLoan,
  serializeLoan,
} from "../../../domain/loans/loan.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";

interface LoanRow {
  id: string;
  name: string;
  category: string;
  principal_minor_units: string;
  currency: string;
  start_date: string;
  number_of_periods: number;
  payment_frequency: string;
  amortization_type: string;
  day_count_convention: string;
  rate_json: string;
  source_account_id: string;
  prepayment_penalty_json: string;
  contract_document_id?: string | null;
}

interface LoanFeeRow {
  id: string;
  loan_id: string;
  description: string;
  amount_minor_units: string;
  currency: string;
  timing: string;
}

function rowsToLoan(row: LoanRow, feeRows: LoanFeeRow[]): Loan {
  const serialized: SerializedLoan = {
    id: row.id,
    name: row.name,
    category: row.category as SerializedLoan["category"],
    principal: { minorUnits: row.principal_minor_units, currency: row.currency },
    startDate: row.start_date,
    numberOfPeriods: row.number_of_periods,
    paymentFrequency: row.payment_frequency as SerializedLoan["paymentFrequency"],
    amortizationType: row.amortization_type as SerializedLoan["amortizationType"],
    dayCountConvention: row.day_count_convention as SerializedLoan["dayCountConvention"],
    rate: JSON.parse(row.rate_json) as SerializedRate,
    sourceAccountId: row.source_account_id,
    fees: feeRows.map((f) => ({
      id: f.id,
      description: f.description,
      amount: { minorUnits: f.amount_minor_units, currency: f.currency },
      timing: f.timing as "origination" | "per_period",
    })),
    prepaymentPenalty: JSON.parse(row.prepayment_penalty_json) as SerializedPrepaymentPenalty,
    ...(row.contract_document_id ? { contractDocumentId: row.contract_document_id } : {}),
  };
  return parseLoan(serialized);
}

export function createSqliteLoanRepository(db: Database): LoanRepository {
  const feesByLoanId = db.prepare("SELECT * FROM loan_fees WHERE loan_id = ?");
  const history = createSqliteEntityHistoryRepository(db);

  return {
    async findById(id: string): Promise<Loan | undefined> {
      const row = db.prepare("SELECT * FROM loans WHERE id = ?").get(id) as LoanRow | undefined;
      if (!row) return undefined;
      const feeRows = feesByLoanId.all(id) as unknown as LoanFeeRow[];
      return rowsToLoan(row, feeRows);
    },

    async list(): Promise<Loan[]> {
      const rows = db.prepare("SELECT * FROM loans ORDER BY name").all() as unknown as LoanRow[];
      return rows.map((row) => rowsToLoan(row, feesByLoanId.all(row.id) as unknown as LoanFeeRow[]));
    },

    async save(loan: Loan): Promise<void> {
      const s = serializeLoan(loan);
      db.exec("BEGIN");
      try {
        db.prepare(
          `INSERT INTO loans (id, name, category, principal_minor_units, currency, start_date, number_of_periods, payment_frequency, amortization_type, day_count_convention, rate_json, source_account_id, prepayment_penalty_json, contract_document_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             category = excluded.category,
             principal_minor_units = excluded.principal_minor_units,
             currency = excluded.currency,
             start_date = excluded.start_date,
             number_of_periods = excluded.number_of_periods,
             payment_frequency = excluded.payment_frequency,
             amortization_type = excluded.amortization_type,
             day_count_convention = excluded.day_count_convention,
             rate_json = excluded.rate_json,
             source_account_id = excluded.source_account_id,
             prepayment_penalty_json = excluded.prepayment_penalty_json,
             contract_document_id = excluded.contract_document_id`,
        ).run(
          s.id,
          s.name,
          s.category,
          s.principal.minorUnits,
          s.principal.currency,
          s.startDate,
          s.numberOfPeriods,
          s.paymentFrequency,
          s.amortizationType,
          s.dayCountConvention,
          JSON.stringify(s.rate),
          s.sourceAccountId,
          JSON.stringify(s.prepaymentPenalty),
          s.contractDocumentId ?? null,
        );

        db.prepare("DELETE FROM loan_fees WHERE loan_id = ?").run(s.id);
        for (const fee of s.fees) {
          db.prepare(
            "INSERT INTO loan_fees (id, loan_id, description, amount_minor_units, currency, timing) VALUES (?, ?, ?, ?, ?, ?)",
          ).run(fee.id, s.id, fee.description, fee.amount.minorUnits, fee.amount.currency, fee.timing);
        }
        history.record({ entityType: "loan", entityId: s.id, changeType: "save", snapshot: s });
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    async delete(id: string): Promise<void> {
      db.exec("BEGIN");
      try {
        const row = db.prepare("SELECT * FROM loans WHERE id = ?").get(id) as LoanRow | undefined;
        const feeRows = row ? (feesByLoanId.all(id) as unknown as LoanFeeRow[]) : [];
        db.prepare("DELETE FROM loans WHERE id = ?").run(id);
        if (row) {
          history.record({
            entityType: "loan",
            entityId: id,
            changeType: "delete",
            snapshot: serializeLoan(rowsToLoan(row, feeRows)),
          });
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
