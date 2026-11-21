import * as readline from "node:readline";
import { createPrismaClient } from "@hokan/db";
import {
  createDisposal,
  createItem,
  createValuation,
  resetDatabaseForE2e,
} from "@hokan/db/testing";

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

function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for the E2E db runner");
  return url;
}

const prisma = createPrismaClient({ databaseUrl: resolveDatabaseUrl(), log: ["error"] });

async function run(command: DbCommand) {
  switch (command.action) {
    case "resetDatabase":
      return resetDatabaseForE2e(prisma).then(() => null);
    case "seedItem":
      return createItem(prisma, {
        name: command.payload.name ?? "Item",
        category: (command.payload.category ?? "other") as never,
        maker: command.payload.maker,
        model: command.payload.model,
        acquiredOn: command.payload.acquiredOn ? new Date(command.payload.acquiredOn) : null,
        acquiredOnApprox: command.payload.acquiredOnApprox ?? false,
        acquisitionType: command.payload.acquisitionType as never,
        purchasePrice: command.payload.purchasePrice,
        purchaseSource: command.payload.purchaseSource,
        conditionAtAcquisition: command.payload.conditionAtAcquisition as never,
        quantity: command.payload.quantity ?? 1,
        purpose: command.payload.purpose,
        location: command.payload.location,
        status: (command.payload.status ?? "owned") as never,
        necessityTier: command.payload.necessityTier as never,
        lastConfirmedOn: command.payload.lastConfirmedOn ? new Date(command.payload.lastConfirmedOn) : null,
        notes: command.payload.notes,
      });
    case "seedDisposal":
      return createDisposal(prisma, {
        itemId: command.payload.itemId,
        disposedOn: command.payload.disposedOn ? new Date(command.payload.disposedOn) : undefined,
        method: command.payload.method as never,
        amount: command.payload.amount,
        channel: command.payload.channel,
        reason: command.payload.reason as never,
        notes: command.payload.notes,
      });
    case "seedValuation":
      return createValuation(prisma, {
        itemId: command.payload.itemId,
        estimatedResalePrice: command.payload.estimatedResalePrice,
        estimatedOn: command.payload.estimatedOn ? new Date(command.payload.estimatedOn) : undefined,
        liquidity: command.payload.liquidity as never,
        source: command.payload.source,
        estimatedBy: command.payload.estimatedBy as never,
      });
  }
}

const rl = readline.createInterface({ input: process.stdin });
let processing = Promise.resolve();

rl.on("line", (line) => {
  processing = processing
    .catch(() => undefined)
    .then(async () => {
      try {
        const command = JSON.parse(line) as DbCommand;
        const result = await run(command);
        process.stdout.write(JSON.stringify(result) + "\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write(JSON.stringify({ error: message }) + "\n");
      }
    });
});

rl.on("close", () => {
  processing = processing.finally(async () => {
    await prisma.$disconnect();
  });
});
