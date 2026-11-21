import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.HOKAN_TEST_BACKEND_PORT);
assert(port && process.env.DATABASE_URL?.includes("hokan_test"), "requires an isolated test slot");
const env = { ...process.env, PORT: String(port), HOKAN_AUTH_MODE: "disabled", HOKAN_LOG_LEVEL: "silent", NODE_ENV: "production" };
delete env.OTEL_EXPORTER_OTLP_ENDPOINT;
delete env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
const child = spawn(process.execPath, ["packages/backend/dist/index.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
let errors = "";
child.stdout.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
child.stderr.setEncoding("utf8").on("data", (chunk) => { errors += chunk; });

try {
  const deadline = Date.now() + 15_000;
  while (!output.includes("hokan backend listening")) {
    assert(Date.now() < deadline, `backend did not start: ${errors}`);
    assert(child.exitCode === null, `backend exited: ${errors}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const response = await fetch(`http://127.0.0.1:${port}/api/items`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "audit-stdout-check" },
    body: JSON.stringify({ name: "stdout-check", category: "other", acquiredOn: "2026-01-10", purchasePrice: 1000 }),
  });
  assert.equal(response.status, 201);
  const requestId = response.headers.get("x-request-id");
  while (!output.includes('"event":"audit"')) {
    assert(Date.now() < deadline, `audit line missing: ${output} ${errors}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const events = output.split("\n").filter((line) => line.startsWith("{")).map((line) => JSON.parse(line));
  const audit = events.find((event) => event.event === "audit");
  assert(audit);
  assert.equal(events.length, 1, "normal log was expected to be silent");
  assert.equal(audit.level, 30);
  assert.equal(audit.schemaVersion, 1);
  assert.equal(audit.status, 201);
  assert.equal(audit.msg, "Audit event");
  assert.equal(audit.requestId, requestId);
  assert.equal(typeof audit.time, "number");
  console.log("Production stdout audit check passed with HOKAN_LOG_LEVEL=silent.");
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}
