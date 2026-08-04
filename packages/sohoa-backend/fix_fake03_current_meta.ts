/**
 * Fix: Reset currentMetadataKey for TT05_FAKE_03 to null
 * so the system falls back to ocrMetadataKey (which has both document types)
 */
import { connectDb, closeDb } from "./db/db-conn.ts";
import { dossiers } from "./db/schemas/dossier.ts";
import { eq } from "drizzle-orm";

const db = connectDb();

console.log("Resetting currentMetadataKey to null for TT05_FAKE_03...");

const result = await db
  .update(dossiers)
  .set({ currentMetadataKey: null, updatedAt: new Date() })
  .where(eq(dossiers.name, "TT05_FAKE_03"))
  .returning({ id: dossiers.id, name: dossiers.name });

console.log("Updated rows:", result);

await closeDb();
Deno.exit(0);
