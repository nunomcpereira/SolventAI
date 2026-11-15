import { Money } from "../money/money.js";
import { IsoDate } from "../dates/isoDate.js";
import { type ParsedStatement, type StatementRow, StatementParseError, checkRunningBalance } from "./statement.js";

/**
 * Caixa Geral de Depósitos "Consultar saldos e movimentos à ordem" CSV export:
 *
 *   Consultar saldos e movimentos à ordem - 14-11-2026
 *   Conta ;0123456789012 - EUR - Conta ...
 *   Data de início ;01-10-2024
 *   Data de fim ;14-11-2026
 *   Data mov. ;Data valor ;Descrição ;Débito ;Crédito ;Saldo contabilístico ;Saldo disponível ;Categoria ;
 *   14-11-2026;14-11-2026;ATM ... ;100,00;;12.345,67;12.345,67;Diversos ;
 *   ...
 *    ; ; ; ;Saldo contabilístico ;12.345,67 EUR ; ; ;
 *
 * `;`-separated, Portuguese numbers ("1.234,56"), dd-mm-yyyy dates, newest row first.
 */
const HEADER_PREFIX = "data mov.";

const clean = (cell: string | undefined) => (cell ?? "").replace(/\s+/g, " ").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function isCgdStatement(text: string): boolean {
  return text.split(/\r?\n/).some((line) => norm(line).trimStart().startsWith(HEADER_PREFIX) && norm(line).includes("saldo contabil"));
}

function parseDate(value: string): IsoDate | undefined {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  return m ? IsoDate.fromParts(Number(m[3]), Number(m[2]), Number(m[1])) : undefined;
}

/** "1.234,56" -> Money; empty -> undefined. */
export function parsePtAmount(value: string, currency: string): Money | undefined {
  const v = value.replace(/\s|EUR|€/gi, "");
  if (v === "") return undefined;
  if (!/^-?[\d.]*,?\d*$/.test(v)) throw new StatementParseError("bad_row", `Not a Portuguese-formatted amount: "${value}"`);
  return Money.fromDecimalString(v.replace(/\./g, "").replace(",", "."), currency);
}

export function parseCgdStatement(text: string): ParsedStatement {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((l) => norm(l).trimStart().startsWith(HEADER_PREFIX));
  if (headerIndex < 0) throw new StatementParseError("unknown_format", "Not a CGD statement: header row not found");

  let externalAccountRef: string | undefined;
  let accountLabel: string | undefined;
  let currency = "EUR";
  let periodStart: IsoDate | undefined;
  let periodEnd: IsoDate | undefined;
  for (const line of lines.slice(0, headerIndex)) {
    const [rawKey, ...rest] = line.split(";");
    const key = norm(clean(rawKey));
    const value = clean(rest.join(";"));
    if (key === "conta") {
      const parts = value.split(" - ").map((p) => p.trim());
      externalAccountRef = parts[0] || undefined;
      if (parts[1] && /^[A-Z]{3}$/.test(parts[1])) currency = parts[1];
      accountLabel = parts.slice(2).join(" - ") || undefined;
    } else if (key.startsWith("data de inicio")) {
      periodStart = parseDate(value);
    } else if (key.startsWith("data de fim")) {
      periodEnd = parseDate(value);
    }
  }

  const fileOrder: StatementRow[] = [];
  let footerBalance: Money | undefined;
  for (const line of lines.slice(headerIndex + 1)) {
    if (line.trim() === "") continue;
    const cells = line.split(";").map(clean);
    const bookingDate = parseDate(cells[0] ?? "");
    if (!bookingDate) {
      const labelIndex = cells.findIndex((c) => norm(c).startsWith("saldo contabil"));
      if (labelIndex >= 0) footerBalance = parsePtAmount(cells[labelIndex + 1] ?? "", currency);
      continue;
    }
    const valueDate = parseDate(cells[1] ?? "") ?? bookingDate;
    const debit = parsePtAmount(cells[3] ?? "", currency);
    const credit = parsePtAmount(cells[4] ?? "", currency);
    if (debit === undefined && credit === undefined) {
      throw new StatementParseError("bad_row", `Row without debit or credit: "${line}"`);
    }
    const amount = (credit ?? Money.zero(currency)).sub(debit ?? Money.zero(currency));
    const balanceAfter = parsePtAmount(cells[5] ?? "", currency);
    const bankCategory = cells[7] || undefined;
    fileOrder.push({
      bookingDate,
      valueDate,
      description: cells[2] ?? "",
      amount,
      ...(balanceAfter !== undefined ? { balanceAfter } : {}),
      ...(bankCategory !== undefined ? { bankCategory } : {}),
    });
  }
  if (fileOrder.length === 0) throw new StatementParseError("no_rows", "The statement has no movements");

  // The export lists newest first; reverse so same-day rows also come out in booking order.
  const rows = [...fileOrder].reverse();
  const closingBalance = footerBalance ?? fileOrder[0]!.balanceAfter;

  return {
    bank: "cgd",
    ...(externalAccountRef !== undefined ? { externalAccountRef } : {}),
    ...(accountLabel !== undefined ? { accountLabel } : {}),
    currency,
    periodStart: periodStart ?? rows[0]!.bookingDate,
    periodEnd: periodEnd ?? rows[rows.length - 1]!.bookingDate,
    ...(closingBalance !== undefined ? { closingBalance } : {}),
    rows,
    balanceCheck: checkRunningBalance(rows),
  };
}
