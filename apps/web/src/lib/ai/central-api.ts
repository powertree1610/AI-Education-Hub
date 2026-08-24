import "server-only";
import { logUsage, type UsageContext } from "./usage-log";

/**
 * Central AI API Server client — ported from the proven ERP implementation
 * (erp-mcp-agent/mysoft-ai-chat/erp-chat/backend/src/openai-client.ts).
 *
 * Pure pass-through: the Central API handles provider routing (DeepSeek,
 * OpenAI, …), per-license API keys, model authorization and usage tracking.
 * Wire format is OpenAI chat-completions. Auth: X-Company-Tin: <LICENSE_KEY>.
 */

export type StreamEvent =
  | { type: "delta"; content: string }
  | { type: "tool_call_delta"; index: number; id?: string; name?: string; arguments: string }
  | { type: "done"; usage?: UsageInfo; finish_reason?: string };

export interface UsageInfo {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null | Array<Record<string, unknown>>;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OpenAiTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

function getConfig() {
  const apiUrl = (process.env.AI_API_SERVER_URL ?? "").replace(/\/+$/, "");
  const licenseKey = (process.env.LICENSE_KEY ?? "").trim();
  if (!apiUrl) throw new Error("AI_API_SERVER_URL is not configured.");
  if (!licenseKey) throw new Error("LICENSE_KEY is not configured.");
  return { apiUrl, licenseKey };
}

/**
 * Reasoning-family models (gpt-5.x and o-series) reject max_tokens and
 * non-default temperature — they take max_completion_tokens instead.
 * Ported from the ERP tokenParamFor helper.
 */
export function tokenParamFor(model: string, max: number): { max_tokens?: number; max_completion_tokens?: number } {
  return /^(gpt-5|o1-|o3-|o4-|chatgpt-)/.test(model.toLowerCase())
    ? { max_completion_tokens: max }
    : { max_tokens: max };
}

export async function chatCompletion(params: {
  model: string;
  messages: ChatMessage[];
  tools?: OpenAiTool[];
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  /** Authorizes the licensed OCR model on the Central API — required for extraction calls. */
  isOcr?: boolean;
  /**
   * Who to bill this call to (ERP convention). Omitted calls are logged as
   * 'unattributed' — deliberately visible rather than silently unlogged.
   */
  usageContext?: UsageContext;
}): Promise<{
  choices: { message: ChatMessage & { reasoning_content?: string }; finish_reason: string }[];
  usage?: UsageInfo;
}> {
  const { apiUrl, licenseKey } = getConfig();

  const body: Record<string, unknown> = { model: params.model, messages: params.messages };
  if (params.tools?.length) body.tools = params.tools;
  if (params.max_tokens) body.max_tokens = params.max_tokens;
  if (params.max_completion_tokens) body.max_completion_tokens = params.max_completion_tokens;
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.isOcr) body.isOcr = true;

  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 120_000;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${apiUrl}/api/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Company-Tin": licenseKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        lastError = errText.slice(0, 300);
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, attempt * 2000));
          continue;
        }
        let errMsg = `Central API error (${res.status}): ${lastError}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error) errMsg = String(errJson.error);
        } catch {
          /* not JSON */
        }
        throw new Error(errMsg);
      }
      const data = (await res.json()) as Awaited<ReturnType<typeof chatCompletion>>;
      await logUsage(params.model, data.usage, params.usageContext ?? { feature: "unattributed" });
      return data;
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === "AbortError") {
        lastError = `timed out after ${TIMEOUT_MS / 1000}s`;
        if (attempt < MAX_RETRIES) continue;
        throw new Error(`Central API timed out after ${TIMEOUT_MS / 1000}s.`);
      }
      throw err;
    }
  }
  throw new Error(`Central API failed after ${MAX_RETRIES} attempts: ${lastError}`);
}

/** Streaming chat completion — SSE in standard OpenAI format. */
export async function* chatCompletionStream(params: {
  model: string;
  messages: ChatMessage[];
  tools?: OpenAiTool[];
  max_tokens?: number;
  temperature?: number;
}): AsyncGenerator<StreamEvent> {
  const { apiUrl, licenseKey } = getConfig();

  const body: Record<string, unknown> = { model: params.model, messages: params.messages };
  if (params.tools?.length) body.tools = params.tools;
  if (params.max_tokens) body.max_tokens = params.max_tokens;
  if (params.temperature !== undefined) body.temperature = params.temperature;

  const controller = new AbortController();
  const TIMEOUT_MS = 180_000;
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${apiUrl}/api/chat/completions/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Company-Tin": licenseKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = `Central API stream error (${res.status}): ${errText.slice(0, 300)}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error) errMsg = String(errJson.error);
      } catch {
        /* not JSON */
      }
      throw new Error(errMsg);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data) continue;
        if (data === "[DONE]") return;

        let chunk: {
          error?: string;
          usage?: UsageInfo;
          choices?: {
            delta?: { content?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] };
            finish_reason?: string;
          }[];
        };
        try {
          chunk = JSON.parse(data);
        } catch {
          continue; // skip unparseable SSE data
        }
        if (chunk.error) throw new Error(chunk.error);

        const delta = chunk.choices?.[0]?.delta;
        const finishReason = chunk.choices?.[0]?.finish_reason;

        if (delta?.content) yield { type: "delta", content: delta.content };
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            yield {
              type: "tool_call_delta",
              index: tc.index ?? 0,
              id: tc.id || undefined,
              name: tc.function?.name || undefined,
              arguments: tc.function?.arguments || "",
            };
          }
        }
        if (finishReason) yield { type: "done", usage: chunk.usage, finish_reason: finishReason };
        // Some providers send usage in a final chunk with empty choices.
        if (chunk.usage && (!chunk.choices || chunk.choices.length === 0)) {
          yield { type: "done", usage: chunk.usage };
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Central API stream timed out after ${TIMEOUT_MS / 1000}s.`);
    }
    throw err;
  }
}
