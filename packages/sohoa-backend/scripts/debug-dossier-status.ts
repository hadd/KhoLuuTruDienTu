import { db } from "../db/db-conn.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { archiveSubmissions } from "../db/schemas/archive-submission.ts";
import { ArchiveSubmissionStatus } from "../db/schemas/archive-constants.ts";
import { isNull, inArray } from "drizzle-orm";

const rows = await db.select({
    name: dossiers.name,
    status: dossiers.status,
    fondId: dossiers.fondId,
    deletedAt: dossiers.deletedAt,
    id: dossiers.id,
})
.from(dossiers)
.where(isNull(dossiers.deletedAt));

console.log("=== ALL DOSSIERS ===");
for (const r of rows) {
    console.log(`name=${r.name} | status=${r.status} | fondId=${r.fondId ? "YES" : "NULL"}`);
}

// Check which ones have approved submissions
const ids = rows.map(r => r.id);
const subs = ids.length === 0 ? [] : await db.select({ dossierId: archiveSubmissions.dossierId })
    .from(archiveSubmissions)
    .where(inArray(archiveSubmissions.dossierId, ids));

const approvedIds = new Set(subs.map(s => s.dossierId));
console.log("\n=== DOSSIERS WITHOUT APPROVED SUBMISSION ===");
for (const r of rows) {
    if (!approvedIds.has(r.id)) {
        console.log(`  ${r.name} | status=${r.status}`);
    }
}
