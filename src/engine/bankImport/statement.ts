import { type Money } from "../money/money.js";
import { type IsoDate } from "../dates/isoDate.js";

/** One movement from a bank statement. `amount` is signed: negative = debit (money out). */
export interface StatementRow {
  bookingDate: IsoDate;
  valueDate: IsoDate;
  description: string;
  amount: Money;
  /** Running balance after this movement, when the bank exports it. */
  balanceAfter?: Money;
  /** The bank's own category label, if any — a hint only, often wrong or generic. */
  bankCategory?: string;
}

export interface ParsedStatement {
  bank: string;
  /** The bank's account number/IBAN as printed in the file header, if present. */
  externalAccountRef?: string;
  accountLabel?: string;
  currency: string;
  periodStart?: IsoDate;
  periodEnd?: IsoDate;
  /** The statement's closing (booked) balance: the footer total, else the newest row's running balance. */
  closingBalance?: Money;
  /** Chronological, oldest first; same-day rows keep the bank's own order. */
  rows: StatementRow[];
  /** Running-balance consistency: each row's balance must equal the previous one plus its amount. */
  balanceCheck: { checked: number; mismatches: number };
}

export type StatementParseErrorCode = "unknown_format" | "no_rows" | "bad_row";

export class StatementParseError extends Error {
  constructor(
    public readonly code: StatementParseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StatementParseError";
  }
}

/** Decodes a statement file: UTF-8 when the bytes are valid UTF-8, else ISO-8859-1 (what Portuguese banks export). */
export function decodeStatementBytes(bytes: Uint8Array): string {
  const withoutBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(withoutBom);
  } catch {
    return new TextDecoder("latin1").decode(withoutBom);
  }
}

/** Counts running-balance mismatches over chronological rows that all carry a balance. */
export function checkRunningBalance(rows: readonly StatementRow[]): { checked: number; mismatches: number } {
  let checked = 0;
  let mismatches = 0;
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!.balanceAfter;
    const cur = rows[i]!.balanceAfter;
    if (prev === undefined || cur === undefined) continue;
    checked++;
    if (!prev.add(rows[i]!.amount).equals(cur)) mismatches++;
  }
  return { checked, mismatches };
}
