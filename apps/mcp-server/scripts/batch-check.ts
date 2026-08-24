/** Dev check: save_observation persists synthesis_batch_id. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import "../src/lib/env.js";

const [studentId, batchId] = [process.argv[2]!, process.argv[3]!];
const client = new Client({ name: "batch-check", version: "0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(process.env.MCP_URL!), {
    requestInit: { headers: { Authorization: `Bearer ${process.env.MCP_SHARED_SECRET}` } },
  }),
);
const res = await client.callTool({
  name: "save_observation",
  arguments: {
    student_id: studentId,
    category: "batch_check",
    statement: "Dev verification row for synthesis_batch_id persistence",
    evidence_source: "ai_session",
    confidence: 0.5,
    synthesis_batch_id: batchId,
    model_version: "batch-check",
  },
});
console.log((res.content as { text: string }[])[0]!.text);
await client.close();
