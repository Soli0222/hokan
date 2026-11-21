export { resetAuth, resetDatabase, resetDatabaseForE2e } from "./reset";
import type { Prisma, PrismaClient } from "./generated/prisma/client.mts";

export type TestPrisma = PrismaClient | Prisma.TransactionClient;

export async function createItem(
  prisma: TestPrisma,
  data: Partial<Prisma.ItemCreateInput> & Pick<Prisma.ItemCreateInput, "name" | "category">,
) {
  return prisma.item.create({
    data: {
      name: data.name,
      category: data.category,
      maker: data.maker ?? null,
      model: data.model ?? null,
      acquiredOn: data.acquiredOn ?? null,
      acquiredOnApprox: data.acquiredOnApprox ?? false,
      acquisitionType: data.acquisitionType ?? null,
      purchasePrice: data.purchasePrice ?? null,
      purchaseSource: data.purchaseSource ?? null,
      conditionAtAcquisition: data.conditionAtAcquisition ?? null,
      quantity: data.quantity ?? 1,
      purpose: data.purpose ?? null,
      location: data.location ?? null,
      status: data.status ?? "owned",
      necessityTier: data.necessityTier ?? null,
      lastConfirmedOn: data.lastConfirmedOn ?? null,
      notes: data.notes ?? null,
    },
    include: { disposal: true, valuations: true },
  });
}

export async function createDisposal(
  prisma: TestPrisma,
  data: Partial<Prisma.DisposalCreateInput> & { itemId: string },
) {
  return prisma.disposal.create({
    data: {
      item: { connect: { id: data.itemId } },
      disposedOn: data.disposedOn ?? new Date(),
      method: data.method ?? "discard",
      amount: data.amount ?? null,
      channel: data.channel ?? null,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
    },
  });
}

export async function createValuation(
  prisma: TestPrisma,
  data: Partial<Prisma.ValuationCreateInput> & { itemId: string },
) {
  return prisma.valuation.create({
    data: {
      item: { connect: { id: data.itemId } },
      estimatedResalePrice: data.estimatedResalePrice ?? 0,
      estimatedOn: data.estimatedOn ?? new Date(),
      liquidity: data.liquidity ?? null,
      source: data.source ?? null,
      estimatedBy: data.estimatedBy ?? "owner",
    },
  });
}
