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
import { int32Schema, nonNegativeInt32Schema } from "../lib/validation";
import { dateSchema } from "./fields";

export const FORMAT_VERSION = 1;

const isoDateTimeSchema = z.string().datetime({ offset: true });
const uuidSchema = z.string().uuid();
const dateOnlySchema = dateSchema;
const nullableDateOnlySchema = dateOnlySchema.nullable();

const disposalSchema = z.object({
  id: uuidSchema,
  itemId: uuidSchema,
  disposedOn: dateOnlySchema,
  method: z.enum(DISPOSAL_METHODS),
  amount: int32Schema().nullable(),
  channel: z.string().max(200).nullable(),
  reason: z.enum(DISPOSAL_REASONS).nullable(),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}).strict();

const valuationSchema = z.object({
  id: uuidSchema,
  itemId: uuidSchema,
  estimatedResalePrice: nonNegativeInt32Schema(),
  estimatedOn: dateOnlySchema,
  liquidity: z.enum(VALUATION_LIQUIDITIES).nullable(),
  source: z.string().max(200).nullable(),
  estimatedBy: z.enum(VALUATION_ESTIMATED_BY),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}).strict();

const itemSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200),
  category: z.enum(ITEM_CATEGORIES),
  maker: z.string().max(200).nullable(),
  model: z.string().max(200).nullable(),
  acquiredOn: nullableDateOnlySchema,
  acquiredOnApprox: z.boolean(),
  acquisitionType: z.enum(ACQUISITION_TYPES).nullable(),
  purchasePrice: int32Schema().nullable(),
  purchaseSource: z.string().max(200).nullable(),
  conditionAtAcquisition: z.enum(ITEM_CONDITIONS).nullable(),
  quantity: z.number().int().min(1),
  purpose: z.string().nullable(),
  location: z.string().max(200).nullable(),
  status: z.enum(ITEM_STATUSES),
  necessityTier: z.enum(NECESSITY_TIERS).nullable(),
  lastConfirmedOn: nullableDateOnlySchema,
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  disposal: disposalSchema.nullable(),
  valuations: z.array(valuationSchema).default([]),
}).strict();

export const exportDataSchema = z.object({
  items: z.array(itemSchema),
}).strict();

export const importPayloadSchema = z.object({
  formatVersion: z.number().int(),
  mode: z.string().optional().default("replace"),
  exportedAt: z.string().optional(),
  data: exportDataSchema,
}).strict();

export type ExportData = z.infer<typeof exportDataSchema>;
