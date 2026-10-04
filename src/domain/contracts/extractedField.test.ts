import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractedFieldSchema } from "./extractedField.js";

const schema = extractedFieldSchema(z.string());

describe("extractedFieldSchema", () => {
  it("accepts a value with non-missing status", () => {
    expect(schema.safeParse({ value: "hello", status: "extracted", confidence: 0.9 }).success).toBe(true);
  });

  it("accepts null value only when status is missing", () => {
    expect(schema.safeParse({ value: null, status: "missing" }).success).toBe(true);
  });

  it("rejects null value with a non-missing status", () => {
    expect(schema.safeParse({ value: null, status: "extracted" }).success).toBe(false);
  });

  it("rejects a non-null value with missing status", () => {
    expect(schema.safeParse({ value: "hello", status: "missing" }).success).toBe(false);
  });

  it("rejects confidence outside [0,1]", () => {
    expect(schema.safeParse({ value: "hello", status: "extracted", confidence: 1.5 }).success).toBe(false);
    expect(schema.safeParse({ value: "hello", status: "extracted", confidence: -0.1 }).success).toBe(false);
  });

  it("rejects unknown status", () => {
    expect(schema.safeParse({ value: "hello", status: "confirmed" }).success).toBe(false);
  });
});
