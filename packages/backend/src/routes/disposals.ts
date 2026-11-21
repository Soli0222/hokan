import { Hono } from "hono";
import { prisma } from "../lib/db";
import { handleRouteError } from "../lib/http";
import { listDisposals } from "../services/items";

export const disposalsRoutes = new Hono()
  .get("/", async (c) => {
    try {
      return c.json(await listDisposals(prisma));
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
