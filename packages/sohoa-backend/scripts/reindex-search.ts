import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { bulkIndexDocuments, configureSearchEngine, isSearchEngineEnabled } from "@shared/search-engine";
import { env } from "../env.ts";
import { connectDb, closeDb } from "../db/db-conn.ts";
import { archiveSubmissions } from "../db/schemas/archive-submission.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { ArchiveSubmissionStatus } from "../db/schemas/archive-constants.ts";
import { DossierStatus } from "../db/schemas/workflow-constants.ts";
import { buildDossierSearchDocument } from "../modules/search/adapters/dossier.adapter.ts";

const BATCH_SIZE = 100;

async function main() {
    configureSearchEngine({
        enabled: env.ELASTICSEARCH_ENABLED,
        url: env.ELASTICSEARCH_URL,
    });

    if (!isSearchEngineEnabled()) {
        console.error("ELASTICSEARCH_ENABLED must be true to run reindex");
        Deno.exit(1);
    }

    connectDb();

    const rows = await connectDb().query.dossiers.findMany({
        where: and(
            isNull(dossiers.deletedAt),
            eq(dossiers.status, DossierStatus.ARCHIVED),
            isNotNull(dossiers.ocrMetadataKey),
        ),
        columns: { id: true },
    });

    console.info(`Found ${rows.length} archived dossiers with OCR metadata`);

    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const docs = [];

        for (const row of batch) {
            try {
                const submission = await connectDb().query.archiveSubmissions.findFirst({
                    where: and(
                        eq(archiveSubmissions.dossierId, row.id),
                        eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
                    ),
                    orderBy: [desc(archiveSubmissions.reviewedAt)],
                    columns: { id: true },
                });
                if (!submission) {
                    skipped += 1;
                    continue;
                }

                const doc = await buildDossierSearchDocument(row.id);
                if (!doc) {
                    skipped += 1;
                    continue;
                }
                docs.push(doc);
            } catch (err) {
                failed += 1;
                console.error(`Failed to build document for dossier ${row.id}:`, err);
            }
        }

        if (docs.length > 0) {
            const result = await bulkIndexDocuments(docs);
            indexed += result.indexed;
            failed += result.failed;
        }

        console.info(`Progress ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
    }

    console.info(`Reindex complete — indexed: ${indexed}, skipped: ${skipped}, failed: ${failed}`);
    await closeDb();
}

if (import.meta.main) {
    main().catch((err) => {
        console.error(err);
        Deno.exit(1);
    });
}
