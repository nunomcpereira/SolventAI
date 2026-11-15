import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCgdStatement, parsePtAmount, isCgdStatement } from "./cgdCsv.js";
import { decodeStatementBytes, StatementParseError } from "./statement.js";
import { parseStatement } from "./parseStatement.js";

const fixture = () => decodeStatementBytes(new Uint8Array(readFileSync(join(process.cwd(), "fixtures/bank/cgd-sample.csv"))));

describe("decodeStatementBytes", () => {
  it("falls back to latin1 when the bytes are not valid UTF-8", () => {
    expect(fixture()).toContain("Descrição");
  });

  it("reads UTF-8 (with or without BOM)", () => {
    const utf8 = new TextEncoder().encode("Descrição");
    expect(decodeStatementBytes(utf8)).toBe("Descrição");
    expect(decodeStatementBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe("Descrição");
  });
});

describe("parsePtAmount", () => {
  it("parses thousands dots and decimal commas", () => {
    expect(parsePtAmount("12.345,67", "EUR")?.toDecimalString()).toBe("12345.67");
    expect(parsePtAmount("0,01", "EUR")?.toDecimalString()).toBe("0.01");
    expect(parsePtAmount("3.404,90 EUR", "EUR")?.toDecimalString()).toBe("3404.90");
    expect(parsePtAmount("", "EUR")).toBeUndefined();
  });

  it("rejects garbage", () => {
    expect(() => parsePtAmount("abc", "EUR")).toThrow(StatementParseError);
  });
});

describe("parseCgdStatement", () => {
  it("reads the header metadata", () => {
    const s = parseCgdStatement(fixture());
    expect(s.bank).toBe("cgd");
    expect(s.externalAccountRef).toBe("0000111122223");
    expect(s.accountLabel).toBe("Conta exemplo");
    expect(s.currency).toBe("EUR");
    expect(s.periodStart?.toString()).toBe("2026-01-01");
    expect(s.periodEnd?.toString()).toBe("2026-03-14");
  });

  it("returns rows oldest first with signed amounts", () => {
    const s = parseCgdStatement(fixture());
    expect(s.rows).toHaveLength(7);
    expect(s.rows[0]!.description).toBe("DEPOSITO");
    expect(s.rows[0]!.amount.toDecimalString()).toBe("1190.00");
    expect(s.rows[1]!.amount.toDecimalString()).toBe("-0.01");
    expect(s.rows[1]!.valueDate.toString()).toBe("2026-02-04");
    expect(s.rows[2]!.bankCategory).toBe("TELE / TV / INTERNET");
    expect(s.rows[6]!.description).toBe("COMPRA SUPERMERCADO EXEMPLO");
  });

  it("takes the closing balance from the footer and checks the running balance", () => {
    const s = parseCgdStatement(fixture());
    expect(s.closingBalance?.toDecimalString()).toBe("3404.90");
    expect(s.balanceCheck).toEqual({ checked: 6, mismatches: 0 });
  });

  it("flags running-balance mismatches", () => {
    const tampered = fixture().replace("3.450,00;3.450,00", "3.460,00;3.460,00");
    expect(parseCgdStatement(tampered).balanceCheck.mismatches).toBe(2);
  });

  it("rejects files without the movements header", () => {
    expect(() => parseCgdStatement("a;b;c\n1;2;3")).toThrow(StatementParseError);
    expect(isCgdStatement("a;b;c")).toBe(false);
    expect(() => parseStatement("a;b;c")).toThrow(StatementParseError);
  });

  it("is picked by the format registry", () => {
    expect(parseStatement(fixture()).bank).toBe("cgd");
  });
});
