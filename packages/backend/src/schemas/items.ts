import { INT4_MAX } from "@hokan/shared";
import {
  ACQUISITION_TYPES,
  DISPOSAL_METHODS,
  DISPOSAL_REASONS,
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
  ITEM_STATUSES,
  NECESSITY_TIERS,
  VALUATION_ESTIMATED_BY,
  VALUATION_LIQUIDITIES,
} from "@hokan/shared";
import { z } from "zod";
import {
  dateSchema,
  name200Schema,
  nonNegativeMoneySchema,
  notesSchema,
  text200Schema,
} from "./fields";

const nullable = <T extends z.ZodTypeAny>(schema: T) => schema.nullable().optional();

export const itemCategorySchema = z.enum(ITEM_CATEGORIES);
export const acquisitionTypeSchema = z.enum(ACQUISITION_TYPES);
export const itemConditionSchema = z.enum(ITEM_CONDITIONS);
export const itemStatusSchema = z.enum(ITEM_STATUSES);
export const necessityTierSchema = z.enum(NECESSITY_TIERS);
export const disposalMethodSchema = z.enum(DISPOSAL_METHODS);
export const disposalReasonSchema = z.enum(DISPOSAL_REASONS);
export const valuationLiquiditySchema = z.enum(VALUATION_LIQUIDITIES);
export const valuationEstimatedBySchema = z.enum(VALUATION_ESTIMATED_BY);

export const createItemSchema = z.object({
  name: name200Schema,
  category: itemCategorySchema,
  maker: nullable(text200Schema),
  model: nullable(text200Schema),
  acquiredOn: nullable(dateSchema),
  acquiredOnApprox: z.boolean().optional(),
  acquisitionType: nullable(acquisitionTypeSchema),
  purchasePrice: nullable(nonNegativeMoneySchema),
  purchaseSource: nullable(text200Schema),
  conditionAtAcquisition: nullable(itemConditionSchema),
  quantity: z.number().int().min(1).max(INT4_MAX).optional(),
  purpose: nullable(notesSchema),
  location: nullable(text200Schema),
  necessityTier: nullable(necessityTierSchema),
  lastConfirmedOn: nullable(dateSchema),
  notes: nullable(notesSchema),
}).strict();

export const updateItemSchema = createItemSchema.partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const confirmItemSchema = z.object({
  necessityTier: necessityTierSchema.nullable().optional(),
}).strict();

export const upsertDisposalSchema = z.object({
  disposedOn: dateSchema,
  method: disposalMethodSchema,
  amount: nullable(nonNegativeMoneySchema),
  channel: nullable(text200Schema),
  reason: nullable(disposalReasonSchema),
  notes: nullable(notesSchema),
}).strict();

export const createValuationSchema = z.object({
  estimatedResalePrice: nonNegativeMoneySchema,
  estimatedOn: dateSchema.optional(),
  liquidity: nullable(valuationLiquiditySchema),
  source: nullable(text200Schema),
  estimatedBy: valuationEstimatedBySchema.optional(),
}).strict();

export const listItemsQuerySchema = z.object({
  name: z.string().max(200).optional(),
  category: itemCategorySchema.optional(),
  status: itemStatusSchema.optional(),
  necessityTier: necessityTierSchema.optional(),
});

export const sellCandidatesQuerySchema = z.object({
  shortfall: z.coerce.number().int().min(1).max(INT4_MAX),
});

export const categoryContextQuerySchema = z.object({
  category: itemCategorySchema,
  maxHoldingDays: z.coerce.number().int().min(1).max(3650).default(180),
});

export const inventoryPendingQuerySchema = z.object({
  category: itemCategorySchema.optional(),
  // "unset" は location 未設定の物品に絞る
  location: z.string().max(200).optional(),
});
