// One child process owns the production API and mock IdP for one Playwright worker.
// The outer runner owns the PostgreSQL container; this child only owns its cloned DB.
import { once } from "node:events";
import { createPrismaClient } from "@hokan/db";
import { startMockIdp, type MockIdp } from "../../packages/backend/src/test-helpers/mock-idp";
import type { Server } from "node:http";

const templateUrl = process.env.HOKAN_E2E_TEMPLATE_URL;
const workerId = process.env.HOKAN_E2E_WORKER_ID;
if (!templateUrl || !process.env.HOKAN_E2E_RUN_ID || !/^\d+$/.test(workerId ?? "")) {
  throw new Error("Start E2E with make test-e2e (isolated template DB and worker ID required)");
}
const template = new URL(templateUrl);
const templateName = template.pathname.slice(1);
if (templateName !== "hokan_test") throw new Error("Unexpected E2E template database");
const databaseName = `e2e_worker_${workerId}`;
const databaseUrl = new URL(template);
databaseUrl.pathname = `/${databaseName}`;
const adminUrl = new URL(template);
adminUrl.pathname = "/postgres";
const admin = createPrismaClient({ databaseUrl: adminUrl.href });
let created = false;
let idp: MockIdp | undefined;
let server: Server | undefined;
let disconnectApi: (() => Promise<void>) | undefined;
let stopping = false;

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  // A deadline only terminates this owned process, never another run's resources.
  const deadline = setTimeout(() => process.exit(1), 8_000);
  try {
    if (server) {
      const closed = new Promise<void>((resolve) => server!.close(() => resolve()));
      server.closeAllConnections();
      await closed;
    }
    await idp?.stop();
    await disconnectApi?.();
    if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.$disconnect();
  } catch (error) {
    console.error(error);
    code = 1;
  } finally {
    clearTimeout(deadline);
    process.exit(code);
  }
}
process.once("disconnect", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
process.once("SIGINT", () => { void shutdown(); });

async function main() {
  // Migrations have completed and their process has exited before workers start.
  // No worker connects to the template, so PostgreSQL can clone it concurrently.
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}" TEMPLATE "${templateName}"`);
  created = true;
  idp = await startMockIdp({ sub: "e2e-user", email: "e2e@example.com" });
  Object.assign(process.env, {
    DATABASE_URL: databaseUrl.href,
    PORT: "0",
    STATIC_DIR: process.env.HOKAN_E2E_STATIC_DIR,
    HOKAN_AUTH_MODE: "enabled",
    HOKAN_OIDC_ISSUER: idp.issuerUrl,
    HOKAN_OIDC_CLIENT_ID: "hokan-e2e",
    HOKAN_OIDC_CLIENT_SECRET: "e2e-secret",
    HOKAN_OIDC_ALLOWED_SUBJECTS: "e2e-user",
    HOKAN_COOKIE_SECURE: "false",
  });
  // Import the actual entry point, including production background tasks.
  const backend = await import("../../packages/backend/src/index");
  server = backend.server as Server;
  const { prisma } = await import("../../packages/backend/src/lib/db");
  disconnectApi = () => prisma.$disconnect();
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing worker API port");
  const baseURL = `http://localhost:${address.port}`;
  // OIDC configuration is read on requests, after these URLs are assigned.
  process.env.HOKAN_OIDC_REDIRECT_URI = `${baseURL}/api/auth/callback`;
  process.env.HOKAN_FRONTEND_URL = baseURL;
  process.send?.({ baseURL, databaseUrl: databaseUrl.href });
}

main().catch(async (error) => {
  console.error(error);
  await shutdown(1);
});
