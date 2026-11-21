import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HokanApiClient } from "./client";
import { registerDashboardTools } from "./tools/dashboard";
import { registerDataTransferTools } from "./tools/data-transfer";
import { registerDisposalTools } from "./tools/disposals";
import { registerItemTools, registerValuationTools } from "./tools/items";

interface BuildServerOptions {
  apiClient: HokanApiClient;
  name?: string;
  version?: string;
}

export function buildServer({
  apiClient,
  name = "hokan-mcp",
  version = "1.0.0",
}: BuildServerOptions) {
  const server = new McpServer({ name, version });

  registerDashboardTools(server, apiClient);
  registerItemTools(server, apiClient);
  registerValuationTools(server, apiClient);
  registerDisposalTools(server, apiClient);
  registerDataTransferTools(server, apiClient);

  return server;
}
