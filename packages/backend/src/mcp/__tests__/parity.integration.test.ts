import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { createApiTokenRecord } from "../../lib/auth";
import { testPrisma } from "../../test-helpers/db";
import { InProcessHokanApiClient } from "../client";
import { buildServer } from "../server";

type ToolResult = Record<string, unknown> & { status: string; amountUnit: string };

describe("MCP and API parity", () => {
  const app = createApp({ authMode: "enabled", enableStaticFallback: false });
  let client: Client;
  let server: ReturnType<typeof buildServer>;

  async function connect(readOnly = false) {
    const { token } = await createApiTokenRecord(`parity-${readOnly ? "readonly" : "write"}`, readOnly);
    server = buildServer({ apiClient: new InProcessHokanApiClient(app, token) });
    client = new Client({ name: "parity-test", version: "1.0.0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
  }

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const output = (result.content as Array<{ text: string }>).at(-1)!.text;
    if (!output.startsWith("{")) throw new Error(`${name}: ${output}`);
    const data = JSON.parse(output) as ToolResult;
    expect(data).toEqual(result.structuredContent);
    return { result, data };
  }

  beforeEach(() => connect());
  afterEach(async () => { await client.close(); await server.close(); });

  it("creates an item through MCP and reads the same record through the API", async () => {
    const created = await call("create_item", {
      name: "キーボード", category: "pc_peripheral", acquiredOn: "2026-01-10", purchasePrice: 12000,
    });
    const item = created.data.item as { id: string; name: string };
    const row = await testPrisma.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.name).toBe("キーボード");

    const detail = await call("get_item", { id: item.id });
    expect((detail.data.item as { id: string }).id).toBe(item.id);

    const list = await call("list_items", { name: "キーボ" });
    expect((list.data.items as Array<{ id: string }>).map(({ id }) => id)).toEqual([item.id]);
  });

  it("requires a write credential for mutations", async () => {
    await client.close();
    await server.close();
    await connect(true);
    const denied = await client.callTool({ name: "create_item", arguments: {
      name: "キーボード", category: "pc_peripheral", acquiredOn: "2026-01-10", purchasePrice: 12000,
    } });
    expect(denied.isError).toBe(true);
    expect((denied.structuredContent as { error: { httpStatus: number } }).error.httpStatus).toBe(403);

    const list = await call("list_items", {});
    expect(list.result.isError).not.toBe(true);
  });
});
