import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { toolOutputSchemas } from "./contracts";
import { HokanApiError, safeErrorText } from "./client";
export { uuidSchema, dateSchema } from "../schemas/fields";

// Keep amount range handling in the API so invalid amounts return its structured
// 400 error through the MCP client instead of an SDK input-validation error.
export const moneySchema = z.number().int();
export const nonNegativeMoneySchema = z.number().int().min(0);

export const booleanFlagSchema = z.union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");
export const confirmDeleteSchema = z.boolean().optional().describe("true の場合のみ削除を実行する。未指定または false では削除前確認だけを返す");

export const readOnlyToolAnnotations = { readOnlyHint: true };
export const createToolAnnotations = { destructiveHint: false, idempotentHint: false };
export const updateToolAnnotations = { destructiveHint: false, idempotentHint: false };
export const deleteToolAnnotations = { destructiveHint: true, idempotentHint: false };

export const responseSchema = {
  status: z.enum(["success", "preview"]),
  amountUnit: z.literal("minor").describe("金額は円の整数"),
};

export function textContent<T extends object>(text: string, data: T, status: "success" | "preview" = "success") {
  // Round-trip once so optional undefined fields are identical on both transports.
  const structuredContent = JSON.parse(JSON.stringify({ ...data, status, amountUnit: "minor" })) as Record<string, unknown>;
  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(structuredContent) },
    ],
    structuredContent,
  };
}

export function toolError(error: unknown) {
  const detail = error instanceof HokanApiError
    ? { message: error.message, httpStatus: error.status, requestId: error.requestId, details: error.details }
    : error instanceof z.ZodError
      ? { message: "入力を確認してください", httpStatus: null, requestId: null,
          details: error.issues.map(({ path, code, message }) => ({ path, code, message: safeErrorText(message) })) }
      : { message: "ツールの実行に失敗しました", httpStatus: null, requestId: null };
  const structuredContent = JSON.parse(JSON.stringify({ status: "error", error: detail })) as Record<string, unknown>;
  return { isError: true, structuredContent, content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }] };
}

export function registerStructuredTool<S extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  config: { description: string; inputSchema: S; outputSchema?: z.ZodRawShape; annotations: ToolAnnotations; rejectedInput?: Record<string, string> },
  callback: (args: z.infer<z.ZodObject<S>>) => Promise<ReturnType<typeof textContent>>,
) {
  const outputSchema = toolOutputSchemas[name];
  if (!outputSchema) throw new Error(`Missing MCP output contract: ${name}`);
  const successShape = { ...responseSchema, ...outputSchema, ...config.outputSchema };
  const successSchema = z.object(successShape).passthrough();
  const errorSchema = z.object({
    message: z.string(),
    httpStatus: z.number().int().nullable(),
    requestId: z.string().nullable(),
    details: z.unknown().optional(),
  }).passthrough();
  // MCP's client validates structuredContent even when isError is true. Keep
  // one object schema for the SDK while expressing the two complete branches
  // in JSON Schema, and enforce the success branch on the server as well.
  const outputShape = {
    ...successSchema.partial().shape,
    status: z.enum(["success", "preview", "error"]),
    error: errorSchema.optional(),
  };
  const successRequired = Object.entries(successShape)
    .filter(([key, schema]) => !z.object({ [key]: schema }).safeParse({}).success)
    .map(([key]) => key);
  const declaredOutputSchema = z.object(outputShape).passthrough()
    .superRefine((value, ctx) => {
      const parsed = value.status === "error"
        ? errorSchema.safeParse(value.error)
        : successSchema.safeParse(value);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: "Invalid tool output", path: [] });
      }
    })
    .meta({ anyOf: [
      { properties: { status: { enum: ["success", "preview"] } }, required: successRequired },
      { properties: { status: { const: "error" } }, required: ["status", "error"] },
    ] });
  // The SDK parses tool arguments before the callback. Validate unknown keys
  // here so a legacy argument cannot be stripped and reported as a success.
  const inputSchema = config.rejectedInput
    ? z.object(config.inputSchema).passthrough().superRefine((value, ctx) => {
      for (const key of Object.keys(value)) {
        if (key in config.inputSchema) continue;
        ctx.addIssue({ code: "custom", path: [key], message: config.rejectedInput?.[key] ?? `未知の引数: ${key}` });
      }
    })
    : config.inputSchema;
  return server.registerTool(name, {
    ...config,
    inputSchema: inputSchema as z.ZodRawShape,
    description: `${config.description}。応答の最後の text は structuredContent と同一の JSON。金額は円の整数。同名対象は ID で区別し、更新前に取得した現行値を保持する。`,
    outputSchema: declaredOutputSchema,
  }, async (args) => {
    try { return await callback(args as z.infer<z.ZodObject<S>>); }
    catch (error) { return toolError(error); }
  });
}

export function registerTool<S extends z.ZodRawShape>(
  server: McpServer, name: string, description: string, inputSchema: S,
  annotations: ToolAnnotations,
  callback: (args: z.infer<z.ZodObject<S>>) => Promise<ReturnType<typeof textContent>>,
  rejectedInput?: Record<string, string>,
) {
  return registerStructuredTool(server, name, { description, inputSchema, annotations, rejectedInput }, callback);
}

export function deletePreview(label: string, id: string, summary: string | null, related: Record<string, unknown> = {}) {
  return textContent(formatDeletePreview(label, id, summary), { ...related, id, deleted: false, executed: false, found: summary !== null, next: { confirm: true } }, "preview");
}

export function formatDeletePreview(label: string, id: string, summary: string | null) {
  return [
    `${label}の削除確認`,
    `ID: ${id}`,
    `対象: ${summary ?? "一覧 API で対象を見つけられませんでした"}`,
    "",
    "削除するには confirm: true を付けて再実行してください。",
  ].join("\n");
}
