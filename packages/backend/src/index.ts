import "./otel";
import { serve } from "@hono/node-server";
import { createApp } from "./app";


const app = createApp();
const port = Number(process.env.PORT ?? "3000");

export const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`hokan backend listening on http://localhost:${info.port}`);
  },
);
