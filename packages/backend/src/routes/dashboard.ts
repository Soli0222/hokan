import { Hono } from "hono";
import { prisma } from "../lib/db";
import { handleRouteError } from "../lib/http";
import {
  categoryContextQuerySchema,
  inventoryPendingQuerySchema,
  sellCandidatesQuerySchema,
} from "../schemas/items";
import {
  getCategoryContext,
  getDashboard,
  getSellCandidates,
  listInventoryPending,
} from "../services/items";

export const dashboardRoutes = new Hono()
  .get("/", async (c) => {
    try {
      return c.json(await getDashboard(prisma));
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/sell-candidates", async (c) => {
    try {
      const query = sellCandidatesQuerySchema.parse(c.req.query());
      return c.json(await getSellCandidates(prisma, query.shortfall));
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/category-context", async (c) => {
    try {
      const query = categoryContextQuerySchema.parse(c.req.query());
      return c.json(await getCategoryContext(prisma, query));
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/inventory-pending", async (c) => {
    try {
      const query = inventoryPendingQuerySchema.parse(c.req.query());
      return c.json(await listInventoryPending(prisma, query));
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
