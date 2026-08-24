/** Prints whether save_observation exposes synthesis_batch_id (dev sanity check). */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import "../src/lib/env.js";

const client = new Client({ name: "schema-check", version: "0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(process.env.MCP_URL!), {
    requestInit: { headers: { Authorization: `Bearer ${process.env.MCP_SHARED_SECRET}` } },
  }),
);
const { tools } = await client.listTools();
const tool = tools.find((t) => t.name === "save_observation");
const props = (tool?.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {};
console.log("save_observation has synthesis_batch_id:", "synthesis_batch_id" in props);
await client.close();
