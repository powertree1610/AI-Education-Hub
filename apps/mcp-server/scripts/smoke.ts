/**
 * Dev smoke test: connects to the running MCP server as a real Streamable
 * HTTP client, lists tools, and exercises reads + writes + the consent gate.
 *
 *   pnpm --filter @platform/mcp-server exec tsx scripts/smoke.ts <student_id>
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import "../src/lib/env.js";

const studentId = process.argv[2];
if (!studentId) {
  console.error("usage: tsx scripts/smoke.ts <student_id>");
  process.exit(1);
}

const url = process.env.MCP_URL || "http://localhost:6710/mcp";
const secret = process.env.MCP_SHARED_SECRET || "";

async function main() {
  const client = new Client({ name: "smoke", version: "0.0.1" });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: secret ? { Authorization: `Bearer ${secret}` } : {} },
  });
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(`tools (${tools.length}):`, tools.map((t) => t.name).join(", "));

  async function call(name: string, args: Record<string, unknown>) {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as { type: string; text?: string }[])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    console.log(`\n── ${name} ${res.isError ? "(ERROR)" : ""} ──`);
    console.log(text.length > 900 ? text.slice(0, 900) + " …" : text);
    return { isError: !!res.isError, text };
  }

  await call("get_student_learning_profile", { student_id: studentId });
  const samples = await call("get_work_samples", { student_id: studentId });
  await call("get_academic_results", { student_id: studentId });
  await call("get_goals", { student_id: studentId });

  const sampleId = JSON.parse(samples.text).work_samples?.[0]?.work_sample_id;
  if (sampleId) {
    await call("save_work_analysis", {
      work_sample_id: sampleId,
      findings: {
        strengths: ["clear sequencing", "varied vocabulary"],
        improvements: ["past tense consistency"],
        recurring_mistakes: ["go/went", "eat/ate"],
        skills_shown: ["narrative structure"],
      },
      suggested_next_activity: "Past-tense verb sorting exercise",
      confidence: 0.81,
      model_version: "smoke-test",
    });
    await call("get_work_analyses", { work_sample_id: sampleId });
  }

  await call("save_observation", {
    student_id: studentId,
    category: "academic_pattern",
    statement: "Past-tense errors persist across recent work samples",
    evidence_source: "work_analysis",
    confidence: 0.78,
    proposed_change: { target: "student_levels", key: "english_writing", from: 2, to: 3 },
    model_version: "smoke-test",
  });
  await call("get_recent_observations", { student_id: studentId });
  await call("suggest_goal", {
    student_id: studentId,
    goal_type: "academic",
    title: "Use past tense correctly in writing",
    subject_code: "ENG",
  });
  await call("get_session_history", { student_id: studentId });

  await client.close();
  console.log("\nsmoke test complete");
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
