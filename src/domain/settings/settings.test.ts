import { describe, expect, it } from "vitest";
import { parseSettings, DEFAULT_SETTINGS } from "./settings.js";
import { DomainValidationError } from "../shared/errors.js";

describe("parseSettings", () => {
  it("parses valid settings, including defaults", () => {
    expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects unknown base currency", () => {
    expect(() => parseSettings({ ...DEFAULT_SETTINGS, baseCurrency: "XXX" })).toThrow(DomainValidationError);
  });

  it("rejects invalid llmEndpoint URL", () => {
    expect(() => parseSettings({ ...DEFAULT_SETTINGS, llmEndpoint: "not-a-url" })).toThrow(DomainValidationError);
  });

  it("rejects unsupported language", () => {
    expect(() => parseSettings({ ...DEFAULT_SETTINGS, language: "it" })).toThrow(DomainValidationError);
  });

  it("defaults cloud LLM fallback to false, and it must be explicit", () => {
    expect(DEFAULT_SETTINGS.allowCloudLlmFallback).toBe(false);
    expect(() => parseSettings({ ...DEFAULT_SETTINGS, allowCloudLlmFallback: undefined })).toThrow();
  });
});
