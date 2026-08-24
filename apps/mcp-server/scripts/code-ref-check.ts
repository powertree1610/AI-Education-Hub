/** Dev check: tools accept a student code (any case) as well as a UUID. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import "../src/lib/env.js";

const client = new Client({ name: "code-ref-check", version: "0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(process.env.MCP_URL!), {
    requestInit: { headers: { Authorization: `Bearer ${process.env.MCP_SHARED_SECRET}` } },
  }),
);

for (const ref of process.argv.slice(2)) {
  const res = await client.callTool({
    name: "get_student_learning_profile",
    arguments: { student_id: ref },
  });
  const text = (res.content as { text: string }[])[0]!.text;
  const parsed = JSON.parse(text) as { student?: { preferred_name?: string }; code?: string };
  console.log(
    `${ref} → ${res.isError ? `ERROR ${parsed.code}` : `OK (${parsed.student?.preferred_name})`}`,
  );
}
await client.close();
