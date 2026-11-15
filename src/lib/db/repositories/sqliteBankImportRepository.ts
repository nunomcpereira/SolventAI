import { type Database } from "../client.js";

/**
 * Imported bank statements and their movements, plus what the user decided about each
 * recurring-item proposal. Raw source data, not part of the financial model: none of it
 * is in entity_history (the items it leads to are), and past-version copies keep it as
 * it is now.
 */

export interface BankImportRecord {
  id: string;
  accountId: string;
  bank: string;
  fileName: string;
  importedAt: string;
  externalAccountRef?: string;
  periodStart?: string;
  periodEnd?: string;
  closingBalanceMinorUnits?: string;
  currency: string;
  rowCount: number;
  newRowCount: number;
  balanceCheckOk: boolean;
}

export interface BankTransactionRecord {
  id: string;
  accountId: string;
  importId: string;
  bookingDate: string;
  valueDate: string;
  description: string;
  /** Signed: negative = money out. */
  amountMinorUnits: string;
  currency: string;
  balanceAfterMinorUnits?: string;
  bankCategory?: string;
}

export type ImportDecision = "accepted" | "dismissed";

interface ImportRow {
  id: string;
  account_id: string;
  bank: string;
  file_name: string;
  imported_at: string;
  external_account_ref: string | null;
  period_start: string | null;
  period_end: string | null;
  closing_balance_minor_units: string | null;
  currency: string;
  row_count: number;
  new_row_count: number;
  balance_check_ok: number;
}

interface TransactionRow {
  id: string;
  account_id: string;
  import_id: string;
  booking_date: string;
  value_date: string;
  description: string;
  amount_minor_units: string;
  currency: string;
  balance_after_minor_units: string | null;
  bank_category: string | null;
}

function toImport(row: ImportRow): BankImportRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    bank: row.bank,
    fileName: row.file_name,
    importedAt: row.imported_at,
    ...(row.external_account_ref !== null ? { externalAccountRef: row.external_account_ref } : {}),
    ...(row.period_start !== null ? { periodStart: row.period_start } : {}),
    ...(row.period_end !== null ? { periodEnd: row.period_end } : {}),
    ...(row.closing_balance_minor_units !== null ? { closingBalanceMinorUnits: row.closing_balance_minor_units } : {}),
    currency: row.currency,
    rowCount: row.row_count,
    newRowCount: row.new_row_count,
    balanceCheckOk: row.balance_check_ok === 1,
  };
}

function toTransaction(row: TransactionRow): BankTransactionRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    importId: row.import_id,
    bookingDate: row.booking_date,
    valueDate: row.value_date,
    description: row.description,
    amountMinorUnits: row.amount_minor_units,
    currency: row.currency,
    ...(row.balance_after_minor_units !== null ? { balanceAfterMinorUnits: row.balance_after_minor_units } : {}),
    ...(row.bank_category !== null ? { bankCategory: row.bank_category } : {}),
  };
}

export function createSqliteBankImportRepository(db: Database) {
  return {
    /** Saves the import and its movements in one transaction; movements already stored
     * (same id) are skipped. Returns how many movements were new. */
    saveImport(record: Omit<BankImportRecord, "newRowCount">, transactions: readonly BankTransactionRecord[]): number {
      const insertTx = db.prepare(
        `INSERT OR IGNORE INTO bank_transactions
           (id, account_id, import_id, booking_date, value_date, description, amount_minor_units, currency, balance_after_minor_units, bank_category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      db.exec("BEGIN");
      try {
        let inserted = 0;
        for (const t of transactions) {
          const result = insertTx.run(
            t.id,
            t.accountId,
            t.importId,
            t.bookingDate,
            t.valueDate,
            t.description,
            t.amountMinorUnits,
            t.currency,
            t.balanceAfterMinorUnits ?? null,
            t.bankCategory ?? null,
          );
          inserted += Number(result.changes);
        }
        db.prepare(
          `INSERT INTO bank_imports
             (id, account_id, bank, file_name, imported_at, external_account_ref, period_start, period_end, closing_balance_minor_units, currency, row_count, new_row_count, balance_check_ok)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          record.id,
          record.accountId,
          record.bank,
          record.fileName,
          record.importedAt,
          record.externalAccountRef ?? null,
          record.periodStart ?? null,
          record.periodEnd ?? null,
          record.closingBalanceMinorUnits ?? null,
          record.currency,
          record.rowCount,
          inserted,
          record.balanceCheckOk ? 1 : 0,
        );
        db.exec("COMMIT");
        return inserted;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    listImports(accountId?: string): BankImportRecord[] {
      const rows = (
        accountId === undefined
          ? db.prepare("SELECT * FROM bank_imports ORDER BY imported_at DESC").all()
          : db.prepare("SELECT * FROM bank_imports WHERE account_id = ? ORDER BY imported_at DESC").all(accountId)
      ) as unknown as ImportRow[];
      return rows.map(toImport);
    },

    findImport(id: string): BankImportRecord | undefined {
      const row = db.prepare("SELECT * FROM bank_imports WHERE id = ?").get(id) as ImportRow | undefined;
      return row ? toImport(row) : undefined;
    },

    /** The account the most recent import of this bank account number went to. */
    accountForExternalRef(ref: string): string | undefined {
      const row = db
        .prepare("SELECT account_id FROM bank_imports WHERE external_account_ref = ? ORDER BY imported_at DESC LIMIT 1")
        .get(ref) as { account_id: string } | undefined;
      return row?.account_id;
    },

    /** Removes an import and the movements it brought in. */
    deleteImport(id: string): void {
      db.exec("BEGIN");
      try {
        db.prepare("DELETE FROM bank_transactions WHERE import_id = ?").run(id);
        db.prepare("DELETE FROM bank_imports WHERE id = ?").run(id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    listTransactions(accountId: string): BankTransactionRecord[] {
      const rows = db
        .prepare("SELECT * FROM bank_transactions WHERE account_id = ? ORDER BY booking_date, rowid")
        .all(accountId) as unknown as TransactionRow[];
      return rows.map(toTransaction);
    },

    listDecisions(accountId: string): Map<string, ImportDecision> {
      const rows = db.prepare("SELECT proposal_key, decision FROM import_decisions WHERE account_id = ?").all(accountId) as {
        proposal_key: string;
        decision: ImportDecision;
      }[];
      return new Map(rows.map((r) => [r.proposal_key, r.decision]));
    },

    setDecision(accountId: string, key: string, decision: ImportDecision, decidedAt: string): void {
      db.prepare(
        `INSERT INTO import_decisions (account_id, proposal_key, decision, decided_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(account_id, proposal_key) DO UPDATE SET decision = excluded.decision, decided_at = excluded.decided_at`,
      ).run(accountId, key, decision, decidedAt);
    },

    clearDecision(accountId: string, key: string): void {
      db.prepare("DELETE FROM import_decisions WHERE account_id = ? AND proposal_key = ?").run(accountId, key);
    },
  };
}

export type BankImportRepository = ReturnType<typeof createSqliteBankImportRepository>;
