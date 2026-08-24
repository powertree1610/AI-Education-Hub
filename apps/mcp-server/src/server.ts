import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGoalTools } from "./tools/goals.js";
import { registerObservationTools } from "./tools/observations.js";
import { registerProfileTools } from "./tools/profile.js";
import { registerResultsTools } from "./tools/results.js";
import { registerSessionTools } from "./tools/sessions.js";
import { registerWorkTools } from "./tools/work.js";

/** One server instance per request (stateless Streamable HTTP). */
export function buildServer(): McpServer {
  const server = new McpServer({
    name: "student-platform-mcp",
    version: "0.1.0",
  });
  registerProfileTools(server);
  registerResultsTools(server);
  registerWorkTools(server);
  registerObservationTools(server);
  registerGoalTools(server);
  registerSessionTools(server);
  return server;
}
