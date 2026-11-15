import { type ParsedStatement, StatementParseError } from "./statement.js";
import { isCgdStatement, parseCgdStatement } from "./cgdCsv.js";

/** A bank's statement format: how to recognise its file and how to read it. */
export interface StatementFormat {
  bank: string;
  detect(text: string): boolean;
  parse(text: string): ParsedStatement;
}

export const STATEMENT_FORMATS: readonly StatementFormat[] = [
  { bank: "cgd", detect: isCgdStatement, parse: parseCgdStatement },
];

/** Picks the first format that recognises `text` and parses it. */
export function parseStatement(text: string): ParsedStatement {
  const format = STATEMENT_FORMATS.find((f) => f.detect(text));
  if (!format) throw new StatementParseError("unknown_format", "Unrecognised statement format");
  return format.parse(text);
}
