import process from "node:process";
import { env } from "./env.ts";
export default {
    schema: "./db/schemas/index.ts",
    out: "./db/drizzle",
    dialect: "postgresql",
    schemaFilter: env.DB_SCHEMA,
    dbCredentials: {
        url: (typeof process !== "undefined" && process.env && process.env.DATABASE_URL) ||
            "postgres://postgres:postgres@localhost:5432/ai_edu",
    },
};


