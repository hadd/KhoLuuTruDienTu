import { db } from "../../db/db-conn.ts";

async function main() {
    console.log("Applying manual SQL...");
    await db.execute('ALTER TABLE "sohoa_app"."duplicate_detection_rules" ADD COLUMN IF NOT EXISTS "dossier_summary_field_key" varchar(128);');
    console.log("Done.");
}

main().catch(console.error).finally(() => process.exit(0));
