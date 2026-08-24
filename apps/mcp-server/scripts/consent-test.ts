/** Quick consent-gate probe: expects get_goals to be refused when
 *  development_tracking is withdrawn. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import "../src/lib/env.js";

const studentId = process.argv[2]!;
const client = new Client({ name: "consent-test", version: "0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(process.env.MCP_URL!), {
    requestInit: { headers: { Authorization: `Bearer ${process.env.MCP_SHARED_SECRET}` } },
  }),
);
const res = await client.callTool({ name: "get_goals", arguments: { student_id: studentId } });
console.log("isError:", res.isError);
console.log((res.content as { text: string }[])[0]!.text);
await client.close();
