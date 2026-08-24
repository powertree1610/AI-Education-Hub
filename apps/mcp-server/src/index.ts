import "./lib/env.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { buildServer } from "./server.js";

const PORT = Number(process.env.MCP_PORT || 6710);
const SHARED_SECRET = process.env.MCP_SHARED_SECRET || "";

const app = express();
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "student-platform-mcp" });
});

// Shared-secret bearer auth between apps/web and this server.
app.use("/mcp", (req, res, next) => {
  if (!SHARED_SECRET) {
    console.warn("[mcp] MCP_SHARED_SECRET not set — running OPEN (dev only)");
    return next();
  }
  const header = req.headers.authorization ?? "";
  if (header === `Bearer ${SHARED_SECRET}`) return next();
  res.status(401).json({ error: "Unauthorized" });
});

// Stateless Streamable HTTP: fresh server + transport per request, so
// concurrent clients never share request-id state.
app.post("/mcp", async (req, res) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Stateless mode has no session to GET/DELETE.
app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "Method not allowed (stateless server)" });
});
app.delete("/mcp", (_req, res) => {
  res.status(405).json({ error: "Method not allowed (stateless server)" });
});

app.listen(PORT, () => {
  console.log(`[mcp] student-platform-mcp listening on http://localhost:${PORT}/mcp (ai_agent role)`);
});
