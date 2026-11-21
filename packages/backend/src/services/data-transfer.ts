import { toDateOnlyString, type DataExportPayloadData } from "@hokan/shared";
import type { Prisma } from "@hokan/db";
import { prisma } from "../lib/db";
import type { ExportData } from "../schemas/data-transfer";

const itemInclude = { disposal: true, valuations: true } as const;

function toIsoString(value: Date) {
  return value.toISOString();
}

function parseDate(value: string | null) {
  return value === null ? null : new Date(value);
}

export async function buildExportData(tx: Prisma.TransactionClient): Promise<DataExportPayloadData> {
  const items = await tx.item.findMany({
    include: itemInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      maker: item.maker,
      model: item.model,
      acquiredOn: toDateOnlyString(item.acquiredOn),
      acquiredOnApprox: item.acquiredOnApprox,
      acquisitionType: item.acquisitionType,
      purchasePrice: item.purchasePrice,
      purchaseSource: item.purchaseSource,
      conditionAtAcquisition: item.conditionAtAcquisition,
      quantity: item.quantity,
      purpose: item.purpose,
      location: item.location,
      status: item.status,
      necessityTier: item.necessityTier,
      lastConfirmedOn: toDateOnlyString(item.lastConfirmedOn),
      notes: item.notes,
      createdAt: toIsoString(item.createdAt),
      updatedAt: toIsoString(item.updatedAt),
      disposal: item.disposal
        ? {
          id: item.disposal.id,
          itemId: item.disposal.itemId,
          disposedOn: toDateOnlyString(item.disposal.disposedOn) ?? "",
          method: item.disposal.method,
          amount: item.disposal.amount,
          channel: item.disposal.channel,
          reason: item.disposal.reason,
          notes: item.disposal.notes,
          createdAt: toIsoString(item.disposal.createdAt),
          updatedAt: toIsoString(item.disposal.updatedAt),
        }
        : null,
      valuations: item.valuations.map((valuation) => ({
        id: valuation.id,
        itemId: valuation.itemId,
        estimatedResalePrice: valuation.estimatedResalePrice,
        estimatedOn: toDateOnlyString(valuation.estimatedOn) ?? "",
        liquidity: valuation.liquidity,
        source: valuation.source,
        estimatedBy: valuation.estimatedBy,
        createdAt: toIsoString(valuation.createdAt),
        updatedAt: toIsoString(valuation.updatedAt),
      })),
    })),
  };
}

export async function replaceAllData(data: ExportData) {
  await prisma.$transaction(async (tx) => {
    await tx.disposal.deleteMany();
    await tx.valuation.deleteMany();
    await tx.item.deleteMany();

    for (const item of data.items) {
      await tx.item.create({
        data: {
          id: item.id,
          name: item.name,
          category: item.category,
          maker: item.maker,
          model: item.model,
          acquiredOn: parseDate(item.acquiredOn),
          acquiredOnApprox: item.acquiredOnApprox,
          acquisitionType: item.acquisitionType,
          purchasePrice: item.purchasePrice,
          purchaseSource: item.purchaseSource,
          conditionAtAcquisition: item.conditionAtAcquisition,
          quantity: item.quantity,
          purpose: item.purpose,
          location: item.location,
          status: item.status,
          necessityTier: item.necessityTier,
          lastConfirmedOn: parseDate(item.lastConfirmedOn),
          notes: item.notes,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
          disposal: item.disposal
            ? {
              create: {
                id: item.disposal.id,
                disposedOn: new Date(item.disposal.disposedOn),
                method: item.disposal.method,
                amount: item.disposal.amount,
                channel: item.disposal.channel,
                reason: item.disposal.reason,
                notes: item.disposal.notes,
                createdAt: new Date(item.disposal.createdAt),
                updatedAt: new Date(item.disposal.updatedAt),
              },
            }
            : undefined,
          valuations: item.valuations.length > 0
            ? {
              create: item.valuations.map((valuation) => ({
                id: valuation.id,
                estimatedResalePrice: valuation.estimatedResalePrice,
                estimatedOn: new Date(valuation.estimatedOn),
                liquidity: valuation.liquidity,
                source: valuation.source,
                estimatedBy: valuation.estimatedBy,
                createdAt: new Date(valuation.createdAt),
                updatedAt: new Date(valuation.updatedAt),
              })),
            }
            : undefined,
        },
      });
    }
  });

  return {
    items: data.items.length,
    disposals: data.items.filter((item) => item.disposal !== null).length,
    valuations: data.items.reduce((total, item) => total + item.valuations.length, 0),
  };
}
