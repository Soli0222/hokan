import {
  compareInventoryOrder,
  needsInventoryConfirmation,
  computeDashboardSummary,
  computeItemMetrics,
  daysBetween,
  fromDateOnlyString,
  selectSellCandidates,
  toDateOnlyString,
  todayDateString,
  type CategoryContextResponse,
  type DashboardResponse,
  type Disposal,
  type DisposalListEntry,
  type Item,
  type ItemMetrics,
  type ItemResponse,
  type SellCandidatesResponse,
  type Valuation,
} from "@hokan/shared";
import type { Prisma, PrismaClient } from "@hokan/db";
import { NotFoundError } from "../lib/http";
import type {
  categoryContextQuerySchema,
  createItemSchema,
  createValuationSchema,
  inventoryPendingQuerySchema,
  listItemsQuerySchema,
  updateItemSchema,
  upsertDisposalSchema,
} from "../schemas/items";
import type { z } from "zod";

type ItemWithRelations = Prisma.ItemGetPayload<{
  include: { disposal: true; valuations: true };
}>;

const itemInclude = { disposal: true, valuations: true } as const;

function toItem(row: ItemWithRelations): Item {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    maker: row.maker,
    model: row.model,
    acquiredOn: toDateOnlyString(row.acquiredOn),
    acquiredOnApprox: row.acquiredOnApprox,
    acquisitionType: row.acquisitionType,
    purchasePrice: row.purchasePrice,
    purchaseSource: row.purchaseSource,
    conditionAtAcquisition: row.conditionAtAcquisition,
    quantity: row.quantity,
    purpose: row.purpose,
    location: row.location,
    status: row.status,
    necessityTier: row.necessityTier,
    lastConfirmedOn: toDateOnlyString(row.lastConfirmedOn),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDisposal(row: Prisma.DisposalGetPayload<object>): Disposal {
  return {
    id: row.id,
    itemId: row.itemId,
    disposedOn: toDateOnlyString(row.disposedOn) ?? "",
    method: row.method,
    amount: row.amount,
    channel: row.channel,
    reason: row.reason,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toValuation(row: Prisma.ValuationGetPayload<object>): Valuation {
  return {
    id: row.id,
    itemId: row.itemId,
    estimatedResalePrice: row.estimatedResalePrice,
    estimatedOn: toDateOnlyString(row.estimatedOn) ?? "",
    liquidity: row.liquidity,
    source: row.source,
    estimatedBy: row.estimatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toItemResponse(row: ItemWithRelations, today?: string): ItemResponse {
  const item = toItem(row);
  return {
    ...item,
    metrics: computeItemMetrics(item, row.disposal ? toDisposal(row.disposal) : null, row.valuations.map(toValuation), today),
  };
}

async function getItemRow(prisma: PrismaClient, id: string) {
  const row = await prisma.item.findUnique({ where: { id }, include: itemInclude });
  if (!row) {
    throw new NotFoundError("Item not found");
  }
  return row;
}

function parseDate(value: string | null | undefined) {
  return value ? fromDateOnlyString(value) : null;
}

export async function listItems(
  prisma: PrismaClient,
  query: z.infer<typeof listItemsQuerySchema>,
) {
  const where: Prisma.ItemWhereInput = {
    ...(query.name ? { name: { contains: query.name, mode: "insensitive" } } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.necessityTier ? { necessityTier: query.necessityTier } : {}),
  };
  const rows = await prisma.item.findMany({
    where,
    include: itemInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  return { items: rows.map((row) => toItemResponse(row)), total: rows.length };
}

export async function getItemDetail(prisma: PrismaClient, id: string) {
  const row = await getItemRow(prisma, id);
  return {
    item: toItemResponse(row),
    disposal: row.disposal ? toDisposal(row.disposal) : null,
    valuations: row.valuations
      .map(toValuation)
      .sort((a, b) => b.estimatedOn.localeCompare(a.estimatedOn) || b.createdAt.localeCompare(a.createdAt)),
  };
}

export async function createItem(prisma: PrismaClient, input: z.infer<typeof createItemSchema>) {
  const row = await prisma.item.create({
    data: {
      name: input.name,
      category: input.category,
      maker: input.maker ?? null,
      model: input.model ?? null,
      acquiredOn: parseDate(input.acquiredOn),
      acquiredOnApprox: input.acquiredOnApprox ?? false,
      acquisitionType: input.acquisitionType ?? null,
      purchasePrice: input.purchasePrice ?? null,
      purchaseSource: input.purchaseSource ?? null,
      conditionAtAcquisition: input.conditionAtAcquisition ?? null,
      quantity: input.quantity ?? 1,
      purpose: input.purpose ?? null,
      location: input.location ?? null,
      necessityTier: input.necessityTier ?? null,
      lastConfirmedOn: parseDate(input.lastConfirmedOn),
      notes: input.notes ?? null,
    },
    include: itemInclude,
  });
  return getItemDetail(prisma, row.id);
}

export async function updateItem(prisma: PrismaClient, id: string, input: z.infer<typeof updateItemSchema>) {
  await getItemRow(prisma, id);
  const data: Prisma.ItemUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.category !== undefined) data.category = input.category;
  if (input.maker !== undefined) data.maker = input.maker;
  if (input.model !== undefined) data.model = input.model;
  if (input.acquiredOn !== undefined) data.acquiredOn = parseDate(input.acquiredOn);
  if (input.acquiredOnApprox !== undefined) data.acquiredOnApprox = input.acquiredOnApprox;
  if (input.acquisitionType !== undefined) data.acquisitionType = input.acquisitionType;
  if (input.purchasePrice !== undefined) data.purchasePrice = input.purchasePrice;
  if (input.purchaseSource !== undefined) data.purchaseSource = input.purchaseSource;
  if (input.conditionAtAcquisition !== undefined) data.conditionAtAcquisition = input.conditionAtAcquisition;
  if (input.quantity !== undefined) data.quantity = input.quantity;
  if (input.purpose !== undefined) data.purpose = input.purpose;
  if (input.location !== undefined) data.location = input.location;
  if (input.necessityTier !== undefined) data.necessityTier = input.necessityTier;
  if (input.lastConfirmedOn !== undefined) data.lastConfirmedOn = parseDate(input.lastConfirmedOn);
  if (input.notes !== undefined) data.notes = input.notes;
  await prisma.item.update({ where: { id }, data });
  return getItemDetail(prisma, id);
}

export async function deleteItem(prisma: PrismaClient, id: string) {
  await getItemRow(prisma, id);
  await prisma.item.delete({ where: { id } });
}

export async function confirmItem(
  prisma: PrismaClient,
  id: string,
  necessityTier: Item["necessityTier"] | undefined,
) {
  await getItemRow(prisma, id);
  await prisma.item.update({
    where: { id },
    data: {
      lastConfirmedOn: fromDateOnlyString(todayDateString()),
      ...(necessityTier !== undefined ? { necessityTier } : {}),
    },
  });
  return getItemDetail(prisma, id);
}

export async function upsertDisposal(
  prisma: PrismaClient,
  itemId: string,
  input: z.infer<typeof upsertDisposalSchema>,
) {
  const item = await getItemRow(prisma, itemId);
  const data = {
    disposedOn: fromDateOnlyString(input.disposedOn),
    method: input.method,
    amount: input.amount ?? null,
    channel: input.channel ?? null,
    reason: input.reason ?? null,
    notes: input.notes ?? null,
  };
  await prisma.$transaction(async (tx) => {
    if (item.disposal) {
      await tx.disposal.update({ where: { itemId }, data });
    } else {
      await tx.disposal.create({ data: { ...data, itemId } });
    }
    await tx.item.update({ where: { id: itemId }, data: { status: "disposed" } });
  });
  return getItemDetail(prisma, itemId);
}

export async function deleteDisposal(prisma: PrismaClient, itemId: string) {
  const item = await getItemRow(prisma, itemId);
  if (!item.disposal) {
    throw new NotFoundError("Disposal not found");
  }
  await prisma.$transaction(async (tx) => {
    await tx.disposal.delete({ where: { itemId } });
    await tx.item.update({ where: { id: itemId }, data: { status: "owned" } });
  });
  return getItemDetail(prisma, itemId);
}

export async function addValuation(
  prisma: PrismaClient,
  itemId: string,
  input: z.infer<typeof createValuationSchema>,
) {
  await getItemRow(prisma, itemId);
  await prisma.valuation.create({
    data: {
      itemId,
      estimatedResalePrice: input.estimatedResalePrice,
      estimatedOn: parseDate(input.estimatedOn) ?? fromDateOnlyString(todayDateString()),
      liquidity: input.liquidity ?? null,
      source: input.source ?? null,
      estimatedBy: input.estimatedBy ?? "owner",
    },
  });
  return getItemDetail(prisma, itemId);
}

export async function listValuations(prisma: PrismaClient, itemId: string) {
  await getItemRow(prisma, itemId);
  const rows = await prisma.valuation.findMany({
    where: { itemId },
    orderBy: [{ estimatedOn: "desc" }, { createdAt: "desc" }],
  });
  return { items: rows.map(toValuation), total: rows.length };
}

export async function listDisposals(prisma: PrismaClient) {
  const rows = await prisma.disposal.findMany({
    include: { item: { include: itemInclude } },
    orderBy: [{ disposedOn: "desc" }, { id: "asc" }],
  });
  const items: DisposalListEntry[] = rows.map((row) => {
    const item = toItem(row.item);
    return {
      ...toDisposal(row),
      item: {
        id: item.id,
        name: item.name,
        category: item.category,
        purchasePrice: item.purchasePrice,
        acquiredOn: item.acquiredOn,
      },
      holdingDays: item.acquiredOn === null ? null : daysBetween(item.acquiredOn, toDateOnlyString(row.disposedOn) ?? ""),
    };
  });
  return { items, total: items.length };
}

export async function getDashboard(prisma: PrismaClient): Promise<DashboardResponse> {
  const rows = await prisma.item.findMany({ include: itemInclude });
  return computeDashboardSummary(
    rows.map((row) => ({
      item: {
        category: row.category,
        necessityTier: row.necessityTier,
        acquiredOn: toDateOnlyString(row.acquiredOn),
        purchasePrice: row.purchasePrice,
        status: row.status,
        lastConfirmedOn: toDateOnlyString(row.lastConfirmedOn),
      },
      disposal: row.disposal ? toDisposal(row.disposal) : null,
      valuations: row.valuations.map(toValuation),
    })),
  );
}

export async function getSellCandidates(prisma: PrismaClient, shortfall: number): Promise<SellCandidatesResponse> {
  const rows = await prisma.item.findMany({
    where: { status: "owned" },
    include: itemInclude,
  });
  const resale = new Map<string, number>();
  const metricsById = new Map<string, ItemMetrics>();
  for (const row of rows) {
    const item = toItem(row);
    const metrics = computeItemMetrics(item, null, row.valuations.map(toValuation));
    metricsById.set(row.id, metrics);
    if (metrics.latestValuation) {
      resale.set(row.id, metrics.latestValuation.estimatedResalePrice);
    }
  }

  const result = selectSellCandidates(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      necessityTier: row.necessityTier,
      purchasePrice: row.purchasePrice,
    })),
    resale,
    shortfall,
  );

  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    shortfall,
    covered: result.covered,
    total: result.total,
    candidates: result.candidates.map((candidate) => ({
      ...candidate,
      item: toItemResponse(byId.get(candidate.itemId)!),
    })),
    excluded: result.excluded,
  };
}

export async function getCategoryContext(
  prisma: PrismaClient,
  query: z.infer<typeof categoryContextQuerySchema>,
): Promise<CategoryContextResponse> {
  const rows = await prisma.item.findMany({
    where: { category: query.category },
    include: itemInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });

  const ownedItems: ItemResponse[] = [];
  const shortLivedDisposals: CategoryContextResponse["shortLivedDisposals"] = [];
  for (const row of rows) {
    const item = toItem(row);
    if (row.status === "owned") {
      ownedItems.push(toItemResponse(row));
      continue;
    }
    if (!row.disposal) {
      continue;
    }
    const disposal = toDisposal(row.disposal);
    const holdingDays = item.acquiredOn === null ? null : daysBetween(item.acquiredOn, disposal.disposedOn);
    if (holdingDays === null || holdingDays <= query.maxHoldingDays) {
      shortLivedDisposals.push({ item, disposal, holdingDays });
    }
  }

  return {
    category: query.category,
    maxHoldingDays: query.maxHoldingDays,
    ownedItems,
    shortLivedDisposals,
  };
}

export async function listInventoryPending(
  prisma: PrismaClient,
  query: z.infer<typeof inventoryPendingQuerySchema>,
) {
  const where: Prisma.ItemWhereInput = { status: "owned" };
  if (query.category) {
    where.category = query.category;
  }
  if (query.location !== undefined) {
    where.location = query.location === "unset" ? null : query.location;
  }
  const rows = await prisma.item.findMany({ where, include: itemInclude });
  const items = rows
    .map((row) => toItemResponse(row))
    .filter((item) => needsInventoryConfirmation(item.lastConfirmedOn))
    .sort(compareInventoryOrder);
  return { items, total: items.length };
}
