/**
 * OpenAI-compatible chat-completions client for a LOCAL LLM server (spec section 3,
 * "Local AI": default `http://localhost:8050/v1`, Ollama/llama.cpp/other
 * OpenAI-compatible local servers). No cloud LLM fallback unless the caller has
 * explicitly set `allowCloudLlmFallback: true` in settings (spec section 27) — this
 * client refuses to talk to a non-local endpoint otherwise, so a misconfigured
 * endpoint can never silently leak contract text off the machine.
 */
export interface LlmClientConfig {
  endpoint: string;
  allowCloudLlmFallback: boolean;
  model?: string;
}

export interface LlmClient {
  complete(prompt: string): Promise<string>;
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export function isLocalEndpoint(endpoint: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(endpoint).hostname);
  } catch {
    return false;
  }
}

export function createLlmClient(config: LlmClientConfig): LlmClient {
  if (!isLocalEndpoint(config.endpoint) && !config.allowCloudLlmFallback) {
    throw new Error(
      `createLlmClient: endpoint "${config.endpoint}" is not local and allowCloudLlmFallback is false. ` +
        "Contract text never leaves this machine unless the user explicitly opts in.",
    );
  }

  return {
    async complete(prompt: string): Promise<string> {
      const response = await fetch(`${config.endpoint.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model ?? "local-model",
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
        }),
      });
      if (!response.ok) {
        throw new Error(`Local LLM request failed: ${response.status} ${response.statusText}`);
      }
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (content === undefined) {
        throw new Error("Local LLM response did not contain choices[0].message.content");
      }
      return content;
    },
  };
}
