import { db } from "../../db/db-conn.ts";

async function main() {
    console.log("Applying manual SQL enum alter...");
    try {
        await db.execute(`ALTER TYPE "sohoa_app"."duplicate_detection_rule_key" ADD VALUE 'FILE_NAME_STRICT';`);
    } catch(e) { console.log(e); }
    try {
        await db.execute(`ALTER TYPE "sohoa_app"."duplicate_detection_rule_key" ADD VALUE 'DOCUMENT_METADATA_SIMILARITY';`);
    } catch(e) { console.log(e); }
    console.log("Done.");
}

main().catch(console.error).finally(() => process.exit(0));
