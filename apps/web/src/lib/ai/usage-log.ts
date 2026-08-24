import "server-only";
import { schema as s } from "@platform/db";
import { getDb } from "@/lib/db";
import type { UsageInfo } from "./central-api";

/**
 * The one place LLM token usage becomes a core.ai_usage_logs row — ported
 * from the ERP usage-log.ts. chatCompletion() calls this automatically via
 * its `usageContext` param; the agent loop writes one aggregated row per
 * turn itself (deferred).
 *
 * Never throws: a usage-logging failure must not fail the chat turn or OCR
 * call that made it.
 */

export interface UsageContext {
  /** Feature slug — written verbatim to usage_type. Max 50 chars. */
  feature: string;
  /** core.users.id; omitted = system/background call, deliberately visible as such. */
  userId?: string | null;
  /** Who the call was about (kiosk sessions, work analysis). */
  studentId?: string | null;
  /** agent_chats.id / ai_sessions.id / work_samples.id — polymorphic, no FK. */
  refId?: string | null;
  /**
   * The caller makes several API calls and writes one aggregated row itself
   * (the agent loop does this per turn). Set so this call is not also logged
   * here, which would double-count the turn.
   */
  deferred?: boolean;
}

/** USD per 1M tokens — ported from the ERP token-estimator (trimmed to the
 *  providers our Central API license routes to). */
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.4": { input: 2.5, output: 10.0 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  // DeepSeek (cache-miss pricing)
  "deepseek-v4-flash": { input: 0.14, output: 0.28 },
  "deepseek-v4-pro": { input: 1.74, output: 3.48 },
};

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  // Unknown hosted models default to gpt-4o pricing; slash-namespaced
  // free-tier models default to 0 (ERP convention).
  const fallback = model.includes("/") ? { input: 0, output: 0 } : PRICING["gpt-4o"]!;
  const prices = PRICING[model] ?? fallback;
  return (
    (promptTokens / 1_000_000) * prices.input + (completionTokens / 1_000_000) * prices.output
  );
}

export async function logUsage(
  model: string,
  usage: UsageInfo | undefined,
  ctx: UsageContext,
): Promise<void> {
  if (ctx.deferred) return;
  try {
    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const totalTokens = usage?.total_tokens || promptTokens + completionTokens;
    await getDb()
      .insert(s.aiUsageLogs)
      .values({
        userId: ctx.userId ?? null,
        studentId: ctx.studentId ?? null,
        usageType: ctx.feature.slice(0, 50),
        refId: ctx.refId ?? null,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost: estimateCost(model, promptTokens, completionTokens).toFixed(6),
        isEstimated: totalTokens === 0,
      });
  } catch (err) {
    console.error(`[usage-log] Failed to log ${ctx.feature} usage:`, (err as Error).message);
  }
}
