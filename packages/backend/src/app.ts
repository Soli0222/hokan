import { context, propagation, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { isSecureCookie } from "./lib/auth";
import { getTraceContextFromSpan, logger, type AuditLogger } from "./lib/logger";
import { createAuthMiddleware } from "./middleware/auth";
import { createAuditMiddleware } from "./middleware/audit";
import { createMcpRoutes } from "./mcp";
import type { McpInternalRequestSnapshot } from "./mcp/client";
import { InternalAuthBridge } from "./mcp/internal-auth";
import { McpRequestContext } from "./mcp/request-context";
import { createMcpOAuthService } from "./lib/mcp-oauth";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { dataTransferRoutes } from "./routes/data-transfer";
import { disposalsRoutes } from "./routes/disposals";
import { itemsRoutes } from "./routes/items";
import { createOAuthMetadataRoutes } from "./routes/oauth-metadata";

const tracer = trace.getTracer("hokan-backend");

export interface CreateAppOptions {
  enableStaticFallback?: boolean;
  staticDir?: string;
  allowedOrigins?: string[];
  authMode?: "enabled" | "disabled";
  mcpOAuthAllowInsecureUrlsForTests?: boolean;
  mcpOAuthFetch?: typeof globalThis.fetch;
  mcpOAuthNow?: () => number;
  auditLogger?: AuditLogger;
  mcpBeforeInternalRequestForTests?: (request: McpInternalRequestSnapshot) => void | Promise<void>;
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function parseAllowedOrigins(value: string | undefined) {
  return value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0) ?? [];
}

function normalizeHost(host: string | undefined) {
  return host?.toLowerCase();
}

function getOriginHost(origin: string) {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

function isOriginAllowed(
  origin: string,
  requestHost: string | undefined,
  allowedOrigins: Set<string>,
) {
  if (origin === "null") {
    return false;
  }
  if (allowedOrigins.has(origin)) {
    return true;
  }

  const originHost = getOriginHost(origin);
  return originHost !== null && originHost === normalizeHost(requestHost);
}

function getContentType(filePath: string) {
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  return "application/octet-stream";
}

export function createApp({
  enableStaticFallback = true,
  staticDir = process.env.STATIC_DIR ?? path.resolve(process.cwd(), "../frontend/dist"),
  allowedOrigins = parseAllowedOrigins(process.env.HOKAN_ALLOWED_ORIGINS),
  authMode = process.env.HOKAN_AUTH_MODE === "disabled" ? "disabled" : "enabled",
  mcpOAuthAllowInsecureUrlsForTests = false,
  mcpOAuthFetch,
  mcpOAuthNow,
  mcpBeforeInternalRequestForTests,
  auditLogger,
}: CreateAppOptions = {}) {
  const app = new Hono();
  const internalAuthBridge = new InternalAuthBridge();
  const mcpRequestContext = new McpRequestContext();
  const mcpOAuthService = createMcpOAuthService({
    authMode,
    allowInsecureUrlsForTests: mcpOAuthAllowInsecureUrlsForTests,
    fetch: mcpOAuthFetch,
    now: mcpOAuthNow,
  });
  const normalizedAllowedOrigins = allowedOrigins
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const allowedOriginSet = new Set(normalizedAllowedOrigins);

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Content-Security-Policy", "frame-ancestors 'none'");
    if (isSecureCookie(c)) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  });

  if (normalizedAllowedOrigins.length > 0) {
    app.use("/api/*", cors({ origin: normalizedAllowedOrigins }));
  }
  app.use("/api/*", createAuditMiddleware(auditLogger));
  app.use("/api/*", async (c, next) => {
    const requestId = c.get("auditRequestId");
    const startedAt = performance.now();
    let status = 500;

    const parentContext = propagation.extract(context.active(), c.req.header());
    const spanName = `${c.req.method} ${c.req.routePath ?? c.req.path}`;

    await tracer.startActiveSpan(
      spanName,
      {
        kind: SpanKind.SERVER,
        attributes: {
          "http.request.method": c.req.method,
          "url.path": c.req.path,
        },
      },
      parentContext,
      async (span) => {
        try {
          await next();
          status = c.res.status;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          const route = c.req.routePath ?? c.req.path;
          span.updateName(`${c.req.method} ${route}`);
          span.setAttribute("http.route", route);

          const auth = c.get("auth");
          logger.info(
            {
              method: c.req.method,
              path: c.req.path,
              status,
              duration_ms: Math.round(performance.now() - startedAt),
              "request-id": requestId,
              "auth.kind": auth?.kind ?? "none",
            },
            "Request completed",
          );

          span.setAttribute("http.response.status_code", status);
          if (status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
          c.set("auditTraceContext", getTraceContextFromSpan(span));
          span.end();
        }
      },
    );
  });
  app.use("/api/*", createAuthMiddleware({ authMode, internalAuthBridge }));
  app.use("/api/*", async (c, next) => {
    if (!STATE_CHANGING_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    const origin = c.req.header("Origin");
    if (!origin || isOriginAllowed(origin, c.req.header("Host"), allowedOriginSet)) {
      await next();
      return;
    }

    return c.json({ error: "Origin not allowed" }, 403);
  });

  app.route("/api/auth", authRoutes);
  app.route("/api", dataTransferRoutes);
  app.route("/api/dashboard", dashboardRoutes);
  app.route("/api/items", itemsRoutes);
  app.route("/api/disposals", disposalsRoutes);

  app.route(
    "/.well-known/oauth-protected-resource/mcp",
    createOAuthMetadataRoutes(mcpOAuthService),
  );
  app.route(
    "/.well-known/oauth-protected-resource",
    createOAuthMetadataRoutes(mcpOAuthService),
  );
  app.use("/mcp", createAuditMiddleware(auditLogger));
  app.route("/mcp", createMcpRoutes(app, {
    authMode,
    oauthService: mcpOAuthService,
    requestContext: mcpRequestContext,
    internalAuthBridge,
    beforeInternalRequestForTests: mcpBeforeInternalRequestForTests,
  }));

  if (!enableStaticFallback) {
    return app;
  }

  if (existsSync(staticDir)) {
    app.get("*", async (c) => {
      if (c.req.path.startsWith("/api/")) return c.notFound();
      const requestPath = c.req.path === "/" ? "/index.html" : c.req.path;
      const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(staticDir, safePath);

      if (existsSync(filePath) && statSync(filePath).isFile()) {
        c.header("Content-Type", getContentType(filePath));
        return c.body(readFileSync(filePath));
      }

      return c.html(readFileSync(path.join(staticDir, "index.html"), "utf8"));
    });
  } else {
    app.get("/", (c) => c.text("hokan backend is running"));
  }

  return app;
}
