import { z } from "zod";

const entity = z.object({}).passthrough();
const items = { items: z.array(entity), total: z.number().int(), complete: z.boolean() };
const history = { items: z.array(entity), total: z.number().int() };
const mutation = { item: entity };
const deletion = {
  id: z.string(),
  deleted: z.boolean(),
  executed: z.boolean(),
};

export const toolOutputSchemas: Record<string, z.ZodRawShape> = {
  list_items: items,
  get_item: { item: entity, disposal: entity.nullable(), valuations: z.array(entity) },
  create_item: mutation,
  update_item: mutation,
  delete_item: deletion,
  confirm_item: mutation,
  list_disposals: history,
  record_disposal: mutation,
  update_disposal: mutation,
  delete_disposal: deletion,
  list_valuations: history,
  add_valuation: mutation,
  get_dashboard: { summary: entity },
  get_sell_candidates: {
    shortfall: z.number().int(),
    covered: z.boolean(),
    total: z.number().int(),
    candidates: z.array(entity),
    excluded: entity,
  },
  get_category_context: {
    category: z.string(),
    maxHoldingDays: z.number().int(),
    ownedItems: z.array(entity),
    shortLivedDisposals: z.array(entity),
  },
  list_inventory_pending: { items: z.array(entity), total: z.number().int() },
  export_data: { export: z.object({ formatVersion: z.number().int(), exportedAt: z.string(), data: z.object({}).passthrough() }).passthrough() },
  import_data: { counts: z.object({}).passthrough(), executed: z.boolean() },
};
