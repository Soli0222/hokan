import { describe, expect, it, vi } from "vitest";
import { logger } from "../lib/logger";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestApp, createTestClient, parseJson } from "../test-helpers/app";
import { createAuditCapture } from "../test-helpers/audit";
import { createApp } from "../app";
import { createApiTokenRecord } from "../lib/auth";

function accountPayload(name: string) {
  return { name, category: "pc_peripheral", acquiredOn: "2026-01-10", purchasePrice: 1000 };
}

function setup(authMode: "enabled" | "disabled" = "disabled") {
  const capture = createAuditCapture();
  const app = createTestApp({ authMode, auditLogger: capture.logger });
  return { ...capture, app, client: createTestClient(app) };
}

describe("audit events", () => {
  it("records changes, failures and validated request IDs", async () => {
    const { client, records } = setup();
    const completed = vi.spyOn(logger, "info");
    const created = await client.post("/api/items", accountPayload("Main"), {
      headers: { "x-request-id": "  req-create  ", "x-hokan-client": "mcp" },
    });
    const account = (await parseJson<{ item: { id: string } }>(created)).item;
    expect(created.status).toBe(201);
    expect(created.headers.get("x-request-id")).toBe("req-create");
    expect((await client.put(`/api/items/${account.id}`, { name: "Updated" }, {
      headers: { "x-hokan-client": "web" },
    })).status).toBe(200);
    expect((await client.delete(`/api/items/${account.id}`)).status).toBe(204);
    expect((await client.get("/api/items")).status).toBe(200);
    const missing = await client.get("/api/nonexistent?code=private-query", {
      headers: { "x-request-id": "x".repeat(41) },
    });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(records.map((record) => [record.status, record.level])).toEqual([
      [201, "info"], [200, "info"], [204, "info"], [404, "warn"],
    ]);
    expect(completed).toHaveBeenCalledWith(expect.objectContaining({ "request-id": "req-create" }), "Request completed");
    completed.mockRestore();
    expect(records[0]).toMatchObject({
      event: "audit", schemaVersion: 1, msg: "Audit event", method: "POST", path: "/api/items",
      clientSource: "mcp", requestId: "req-create", authKind: "disabled", subject: "disabled",
      authMode: "disabled", issuer: null, oauthClientId: null, sessionId: null, apiTokenId: null,
    });
    expect(records[3]).toMatchObject({ requestId: missing.headers.get("x-request-id"), path: "/api/nonexistent" });
    expect(JSON.stringify(records)).not.toContain("private-query");
  });


  it("keeps query, request body and long path out of the serialized event", async () => {
    const { client, records } = setup();
    const invalid = await client.post("/api/items?code=private-query", {
      ...accountPayload("private-body"), sortOrder: "invalid",
    });
    expect(invalid.status).toBe(400);
    const long = await client.get(`/api/${"x".repeat(400)}`);
    expect(long.status).toBe(404);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ path: "/api/items", status: 400 });
    expect(records[1]).toMatchObject({ path: `/api/${"x".repeat(295)}`, status: 404 });
    expect(JSON.stringify(records)).not.toMatch(/private-query|private-body/);
  });

  it("keeps verified identity on read-only and Origin failures", async () => {
    const { client, records } = setup("enabled");
    expect((await client.get("/api/items", { headers: { Authorization: "Bearer hokan_tok_invalid" } })).status).toBe(401);
    const { token, record } = await createApiTokenRecord("audit-readonly", true);
    expect((await client.post("/api/items", accountPayload("Blocked"), {
      headers: { Authorization: `Bearer ${token}` },
    })).status).toBe(403);
    const { token: writeToken, record: writeRecord } = await createApiTokenRecord("audit-origin");
    expect((await client.post("/api/items", accountPayload("Blocked"), {
      headers: { Authorization: `Bearer ${writeToken}`, Origin: "https://evil.example" },
    })).status).toBe(403);
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ subject: null, authKind: null, apiTokenId: null });
    expect(records[1]).toMatchObject({ authKind: "token", apiTokenId: record.id });
    expect(records[2]).toMatchObject({ authKind: "token", apiTokenId: writeRecord.id });
    expect(JSON.stringify(records)).not.toContain(token);
    expect(JSON.stringify(records)).not.toContain(writeToken);
  });

  it("records unexpected 500 and ignores synchronous sink failures", async () => {
    const { app, records } = setup();
    app.get("/api/audit-failure-test", () => { throw new Error("private error detail"); });
    expect((await app.request("/api/audit-failure-test")).status).toBe(500);
    expect(records[0]).toMatchObject({ status: 500, level: "error" });
    expect(JSON.stringify(records)).not.toContain("private error detail");
    const broken = createAuditCapture();
    broken.logger.info = () => { throw new Error("sink unavailable"); };
    const client = createTestClient(createTestApp({ auditLogger: broken.logger }));
    expect((await client.post("/api/items", accountPayload("Still succeeds"))).status).toBe(201);
    expect(broken.records).toHaveLength(0);
  });

  it("does not serve the removed API through the static fallback", async () => {
    const staticDir = mkdtempSync(path.join(os.tmpdir(), "hokan-audit-static-"));
    try {
      writeFileSync(path.join(staticDir, "index.html"), "<html>app</html>");
      const capture = createAuditCapture();
      const app = createApp({ authMode: "disabled", enableStaticFallback: true, staticDir, auditLogger: capture.logger });
      expect((await app.request("/api/audit-logs")).status).toBe(404);
    } finally {
      rmSync(staticDir, { recursive: true, force: true });
    }
  });
});
