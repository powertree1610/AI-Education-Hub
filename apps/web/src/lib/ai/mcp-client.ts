import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OpenAiTool } from "./central-api";

/**
 * MCP client bridge: the web backend is an MCP CLIENT of apps/mcp-server
 * (Streamable HTTP, shared-secret bearer auth). MCP tool schemas convert
 * directly to OpenAI function-calling definitions for the Central API.
 */

const TOOLS_CACHE_TTL_MS = 5 * 60 * 1000;

const globalForMcp = globalThis as unknown as {
  __mcpTools?: { tools: OpenAiTool[]; fetchedAt: number };
};

function mcpUrl(): string {
  return process.env.MCP_URL || "http://localhost:6710/mcp";
}

async function connect(): Promise<Client> {
  const client = new Client({ name: "student-platform-web", version: "0.1.0" });
  const secret = process.env.MCP_SHARED_SECRET || "";
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl()), {
    requestInit: {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    },
  });
  await client.connect(transport);
  return client;
}

/** MCP tools converted to OpenAI function definitions (cached 5 min). */
export async function listMcpToolsAsOpenAi(): Promise<OpenAiTool[]> {
  const cached = globalForMcp.__mcpTools;
  if (cached && Date.now() - cached.fetchedAt < TOOLS_CACHE_TTL_MS) return cached.tools;

  const client = await connect();
  try {
    const { tools } = await client.listTools();
    const converted: OpenAiTool[] = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: (tool.inputSchema as Record<string, unknown>) ?? { type: "object" },
      },
    }));
    globalForMcp.__mcpTools = { tools: converted, fetchedAt: Date.now() };
    return converted;
  } finally {
    await client.close();
  }
}

export function isMcpTool(name: string): boolean {
  return (globalForMcp.__mcpTools?.tools ?? []).some((t) => t.function.name === name);
}

/** Execute one MCP tool call; returns the tool's text payload (JSON string). */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const client = await connect();
  try {
    const res = await client.callTool({ name, arguments: args });
    const text = ((res.content ?? []) as { type: string; text?: string }[])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    return { text: text || "{}", isError: !!res.isError };
  } finally {
    await client.close();
  }
}
