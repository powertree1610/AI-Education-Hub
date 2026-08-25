/**
 * Dev check for tool #11: flags a safeguarding concern via the running MCP
 * server (ai_agent role → SECURITY DEFINER function) and prints the result.
 * DB-side assertions are done separately with psql as owner.
 *
 *   pnpm --filter @platform/mcp-server exec tsx scripts/safeguarding-check.ts <student_ref>
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import "../src/lib/env.js";

const studentRef = process.argv[2];
if (!studentRef) {
  console.error("usage: tsx scripts/safeguarding-check.ts <student_ref>");
  process.exit(1);
}

const url = process.env.MCP_URL || "http://localhost:6710/mcp";
const secret = process.env.MCP_SHARED_SECRET || "";

async function main() {
  const client = new Client({ name: "safeguarding-check", version: "0.0.1" });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: secret ? { Authorization: `Bearer ${secret}` } : {} },
  });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const found = tools.some((t) => t.name === "flag_safeguarding_concern");
  console.log(`tool listed: ${found} (total ${tools.length})`);
  if (!found) process.exit(1);

  const res = await client.callTool({
    name: "flag_safeguarding_concern",
    arguments: {
      student_id: studentRef,
      reason: "[DEV CHECK] Smoke-test flag from safeguarding-check.ts — ignore and close.",
      confidence: 0.5,
    },
  });
  const text = (res.content as { type: string; text?: string }[])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  console.log(`isError=${!!res.isError}\n${text}`);
  await client.close();
  process.exit(res.isError ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
