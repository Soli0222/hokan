import {
  spawn,
  type ChildProcessByStdio,
} from "node:child_process";
import path from "node:path";
import * as readline from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { Disposal, Item, Valuation } from "@hokan/db";

type DbCommand =
  | { action: "resetDatabase" }
  | {
    action: "seedItem";
    payload: {
      name?: string;
      category?: string;
      maker?: string | null;
      model?: string | null;
      acquiredOn?: string | null;
      acquiredOnApprox?: boolean;
      acquisitionType?: string | null;
      purchasePrice?: number | null;
      purchaseSource?: string | null;
      conditionAtAcquisition?: string | null;
      quantity?: number;
      purpose?: string | null;
      location?: string | null;
      status?: string;
      necessityTier?: string | null;
      lastConfirmedOn?: string | null;
      notes?: string | null;
    };
  }
  | {
    action: "seedDisposal";
    payload: {
      itemId: string;
      disposedOn?: string;
      method?: string;
      amount?: number | null;
      channel?: string | null;
      reason?: string | null;
      notes?: string | null;
    };
  }
  | {
    action: "seedValuation";
    payload: {
      itemId: string;
      estimatedResalePrice?: number;
      estimatedOn?: string;
      liquidity?: string | null;
      source?: string | null;
      estimatedBy?: string;
    };
  };

type DbRunnerProcess = ChildProcessByStdio<Writable, Readable, null>;

let child: DbRunnerProcess | null = null;
let lineQueue: Array<{ resolve: (line: string) => void; reject: (error: Error) => void }> = [];
let commandQueue = Promise.resolve();
let databaseUrl: string | undefined;

export function configureDatabase(url: string) {
  if (child) throw new Error("DB runner is already running");
  databaseUrl = url;
}

export async function stopDatabaseRunner() {
  const current = child;
  if (!current) return;
  await new Promise<void>((resolve) => {
    current.once("exit", () => resolve());
    current.stdin.end();
  });
  databaseUrl = undefined;
}

function resetRunner() {
  child = null;
  lineQueue = [];
}

function rejectPendingLines(error: Error) {
  const pending = lineQueue;
  lineQueue = [];
  pending.forEach(({ reject }) => reject(error));
}

const tsxPath = path.resolve(
  "packages/backend/node_modules/tsx/dist/loader.mjs",
);
const runnerPath = path.resolve("e2e/helpers/db-runner.ts");

function ensureRunner() {
  if (child) {
    return child;
  }

  if (!databaseUrl) throw new Error("E2E database fixture was not initialized");
  const nextChild = spawn(
    process.execPath,
    ["--import", tsxPath, runnerPath],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ["pipe", "pipe", "inherit"],
    },
  );

  const nextRl = readline.createInterface({ input: nextChild.stdout });

  nextRl.on("line", (line) => {
    const pending = lineQueue.shift();
    if (pending) {
      pending.resolve(line);
    }
  });

  nextChild.on("error", (error) => {
    rejectPendingLines(error);
    nextRl.close();
    resetRunner();
  });

  nextChild.once("exit", () => {
    rejectPendingLines(new Error("DB runner exited"));
    nextRl.close();
    resetRunner();
  });

  child = nextChild;
  return nextChild;
}

function sendCommand(command: DbCommand): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const currentChild = ensureRunner();
    lineQueue.push({ resolve, reject });
    currentChild.stdin.write(JSON.stringify(command) + "\n", (error) => {
      if (error) {
        const pending = lineQueue.pop();
        if (pending) reject(error);
      }
    });
  });
}

async function runDbCommand<T>(command: DbCommand): Promise<T> {
  const request = commandQueue.then(() => sendCommand(command));
  commandQueue = request.then(
    () => undefined,
    () => undefined,
  );
  const line = await request;
  const result = JSON.parse(line) as { error?: string } | T;
  if (
    result !== null &&
    typeof result === "object" &&
    "error" in result &&
    typeof result.error === "string"
  ) {
    throw new Error(result.error);
  }

  return result as T;
}

function serializeOptionalDate(date: Date | undefined): string | undefined {
  return date?.toISOString().slice(0, 10);
}

process.once("exit", () => {
  if (child && !child.killed) {
    child.stdin.end();
  }
});

export async function resetDatabase() {
  await runDbCommand<null>({ action: "resetDatabase" });
}

export async function seedItem(overrides: DbCommand extends never ? never : {
  name?: string;
  category?: string;
  maker?: string | null;
  model?: string | null;
  acquiredOn?: Date | null;
  acquiredOnApprox?: boolean;
  acquisitionType?: string | null;
  purchasePrice?: number | null;
  purchaseSource?: string | null;
  conditionAtAcquisition?: string | null;
  quantity?: number;
  purpose?: string | null;
  location?: string | null;
  status?: string;
  necessityTier?: string | null;
  lastConfirmedOn?: Date | null;
  notes?: string | null;
}): Promise<Item> {
  const { acquiredOn, lastConfirmedOn, ...rest } = overrides;
  return runDbCommand<Item>({
    action: "seedItem",
    payload: {
      name: rest.name,
      category: rest.category,
      maker: rest.maker,
      model: rest.model,
      acquiredOn: acquiredOn === undefined ? undefined : acquiredOn === null ? null : serializeOptionalDate(acquiredOn),
      acquiredOnApprox: rest.acquiredOnApprox,
      acquisitionType: rest.acquisitionType,
      purchasePrice: rest.purchasePrice,
      purchaseSource: rest.purchaseSource,
      conditionAtAcquisition: rest.conditionAtAcquisition,
      quantity: rest.quantity,
      purpose: rest.purpose,
      location: rest.location,
      status: rest.status,
      necessityTier: rest.necessityTier,
      lastConfirmedOn: lastConfirmedOn === undefined ? undefined : lastConfirmedOn === null ? null : serializeOptionalDate(lastConfirmedOn),
      notes: rest.notes,
    },
  });
}

export async function seedDisposal(overrides: {
  itemId: string;
  disposedOn?: Date;
  method?: string;
  amount?: number | null;
  channel?: string | null;
  reason?: string | null;
  notes?: string | null;
}): Promise<Disposal> {
  const { disposedOn, ...rest } = overrides;
  return runDbCommand<Disposal>({
    action: "seedDisposal",
    payload: {
      ...rest,
      disposedOn: serializeOptionalDate(disposedOn),
    },
  });
}

export async function seedValuation(overrides: {
  itemId: string;
  estimatedResalePrice?: number;
  estimatedOn?: Date;
  liquidity?: string | null;
  source?: string | null;
  estimatedBy?: string;
}): Promise<Valuation> {
  const { estimatedOn, ...rest } = overrides;
  return runDbCommand<Valuation>({
    action: "seedValuation",
    payload: {
      ...rest,
      estimatedOn: serializeOptionalDate(estimatedOn),
    },
  });
}
