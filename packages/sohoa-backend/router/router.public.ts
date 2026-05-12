import { Elysia } from "elysia";
import { healthPlugin } from "@shared/http-libs";
import { env } from "../env.ts";

export const PUBLIC_PREFIX = "/api/public";
export const publicRouter = new Elysia({
    prefix: PUBLIC_PREFIX,
});

publicRouter.use(healthPlugin({
    db_connection_str: env.DATABASE_URL,
}));
