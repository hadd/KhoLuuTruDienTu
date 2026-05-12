import { pgSchema, pgTable, pgEnum } from "drizzle-orm/pg-core";
import { env } from "../../env.ts";

const PUBLIC_SCHEMA = "public";

/** Unifies `pgTable` vs `pgSchema(...).table` so `schema.table` is callable under strict TS. */
export type DrizzleSchemaModule = {
  table: typeof pgTable;
  enum: typeof pgEnum;
};

export const schema: DrizzleSchemaModule = (
  env.DB_SCHEMA === PUBLIC_SCHEMA ? { table: pgTable, enum: pgEnum } : pgSchema(env.DB_SCHEMA)
) as DrizzleSchemaModule;
