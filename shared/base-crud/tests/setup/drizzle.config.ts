import process from "node:process";

const schemaFile = new URL("schema.ts", import.meta.url);
const schemaPath = schemaFile.pathname;
const outDir = new URL(".drizzle", import.meta.url).pathname;

export default {
    schema: schemaPath,
    out: outDir,
    dialect: "postgresql",
    schemaFilter: ["test_base_service"],
    dbCredentials: {
        url: (typeof process !== "undefined" && process.env && process.env.DATABASE_URL) 
    },
};

