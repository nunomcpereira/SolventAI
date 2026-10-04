import { describe, expect, it, vi, afterEach } from "vitest";
import { isLocalEndpoint, createLlmClient } from "./llmClient.js";

describe("isLocalEndpoint", () => {
  it("recognizes localhost and loopback addresses", () => {
    expect(isLocalEndpoint("http://localhost:8050/v1")).toBe(true);
    expect(isLocalEndpoint("http://127.0.0.1:8050/v1")).toBe(true);
  });

  it("rejects a remote host", () => {
    expect(isLocalEndpoint("https://api.openai.com/v1")).toBe(false);
  });

  it("returns false for an invalid URL rather than throwing", () => {
    expect(isLocalEndpoint("not a url")).toBe(false);
  });
});

describe("createLlmClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses a non-local endpoint without explicit cloud fallback opt-in", () => {
    expect(() => createLlmClient({ endpoint: "https://api.openai.com/v1", allowCloudLlmFallback: false })).toThrow(
      /not local/,
    );
  });

  it("allows a non-local endpoint when allowCloudLlmFallback is true", () => {
    expect(() =>
      createLlmClient({ endpoint: "https://api.openai.com/v1", allowCloudLlmFallback: true }),
    ).not.toThrow();
  });

  it("posts to {endpoint}/chat/completions and returns the message content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "hello from the model" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createLlmClient({ endpoint: "http://localhost:8050/v1", allowCloudLlmFallback: false });
    const result = await client.complete("prompt text");

    expect(result).toBe("hello from the model");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8050/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws when the HTTP response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" }));
    const client = createLlmClient({ endpoint: "http://localhost:8050/v1", allowCloudLlmFallback: false });
    await expect(client.complete("x")).rejects.toThrow(/500/);
  });

  it("throws when the response has no choices[0].message.content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }));
    const client = createLlmClient({ endpoint: "http://localhost:8050/v1", allowCloudLlmFallback: false });
    await expect(client.complete("x")).rejects.toThrow(/did not contain/);
  });
});
