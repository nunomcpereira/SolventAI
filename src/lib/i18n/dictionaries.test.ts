import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const LANGUAGES = ["en", "pt", "es", "de", "fr"] as const;

function loadDictionary(lang: string): unknown {
  return JSON.parse(readFileSync(join(here, "dictionaries", `${lang}.json`), "utf-8"));
}

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([key, value]) => flattenKeys(value, prefix ? `${prefix}.${key}` : key));
}

describe("i18n dictionaries", () => {
  const reference = flattenKeys(loadDictionary("en")).sort();

  it("reference (en) dictionary is non-empty", () => {
    expect(reference.length).toBeGreaterThan(0);
  });

  for (const lang of LANGUAGES.filter((l) => l !== "en")) {
    it(`${lang}.json has exactly the same keys as en.json (no missing, no extra)`, () => {
      const keys = flattenKeys(loadDictionary(lang)).sort();
      const missing = reference.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !reference.includes(k));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    it(`${lang}.json has no empty string values`, () => {
      const dict = loadDictionary(lang);
      const empties = flattenKeys(dict).filter((key) => {
        const value = key.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], dict);
        return typeof value === "string" && value.trim() === "";
      });
      expect(empties).toEqual([]);
    });
  }
});
