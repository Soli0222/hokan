import { Hono } from "hono";
import { prisma } from "../lib/db";
import { handleRouteError } from "../lib/http";
import {
  confirmItemSchema,
  createItemSchema,
  createValuationSchema,
  listItemsQuerySchema,
  updateItemSchema,
  upsertDisposalSchema,
} from "../schemas/items";
import { uuidSchema } from "../schemas/fields";
import {
  addValuation,
  confirmItem,
  createItem,
  deleteDisposal,
  deleteItem,
  getItemDetail,
  listItems,
  listValuations,
  updateItem,
  upsertDisposal,
} from "../services/items";

export const itemsRoutes = new Hono()
  .get("/", async (c) => {
    try {
      const query = listItemsQuerySchema.parse(c.req.query());
      return c.json(await listItems(prisma, query));
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/", async (c) => {
    try {
      const input = createItemSchema.parse(await c.req.json());
      return c.json(await createItem(prisma, input), 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/:id", async (c) => {
    try {
      const id = uuidSchema.parse(c.req.param("id"));
      return c.json(await getItemDetail(prisma, id));
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .put("/:id", async (c) => {
    try {
      const id = uuidSchema.parse(c.req.param("id"));
      const input = updateItemSchema.parse(await c.req.json());
      return c.json(await updateItem(prisma, id, input));
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .delete("/:id", async (c) => {
    try {
      const id = uuidSchema.parse(c.req.param("id"));
      await deleteItem(prisma, id);
      return c.body(null, 204);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/:id/confirm", async (c) => {
    try {
      const id = uuidSchema.parse(c.req.param("id"));
      const body = await c.req.json().catch(() => ({}));
      const input = confirmItemSchema.parse(body);
      return c.json(await confirmItem(prisma, id, input.necessityTier));
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .put("/:id/disposal", async (c) => {
    try {
      const id = uuidSchema.parse(c.req.param("id"));
      const input = upsertDisposalSchema.parse(await c.req.json());
      return c.json(await upsertDisposal(prisma, id, input));
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .delete("/:id/disposal", async (c) => {
    try {
      const id = uuidSchema.parse(c.req.param("id"));
      return c.json(await deleteDisposal(prisma, id));
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/:id/valuations", async (c) => {
    try {
      const id = uuidSchema.parse(c.req.param("id"));
      return c.json(await listValuations(prisma, id));
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/:id/valuations", async (c) => {
    try {
      const id = uuidSchema.parse(c.req.param("id"));
      const input = createValuationSchema.parse(await c.req.json());
      return c.json(await addValuation(prisma, id, input), 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
