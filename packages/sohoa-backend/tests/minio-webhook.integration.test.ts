import { assertEquals, assertExists } from "@std/assert";
import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { DossierStatus, EntityType } from "../db/schemas/workflow-constants.ts";
import { env } from "../env.ts";
import { createOcrCallbackRouter } from "../modules/ocr-callback/ocr-callback.router.ts";
import { handleMinioWebhook } from "../modules/ocr-callback/minio-webhook.handler.ts";
import { handleOcrCallback } from "../modules/ocr-callback/ocr-callback-service.ts";

const testApp = new Elysia({ prefix: "/api/v1" }).use(createOcrCallbackRouter("/internal"));

const TEST_PREFIX = `test-minio-webhook/${crypto.randomUUID()}`;
const BUCKET = env.S3?.bucket ?? "data-lake";
const WEBHOOK_SECRET = env.MINIO_WEBHOOK_SECRET || env.INTERNAL_API_KEY;

function buildMinioPayload(outputPath: string) {
    return {
        Records: [
            {
                eventName: "s3:ObjectCreated:Put",
                s3: {
                    bucket: { name: BUCKET },
                    object: { key: outputPath },
                },
            },
        ],
    };
}

async function cleanup(folderPath: string) {
    await db.delete(dossiers).where(eq(dossiers.folderPath, folderPath));
    await db.delete(folders).where(eq(folders.folderPath, folderPath));
}

Deno.test({
    name: "MinIO webhook integration",
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async (t) => {
    const hoSoId = "ho-so-webhook";
    const outputPath = `processed/${TEST_PREFIX}/${hoSoId}.json`;
    const folderPath = `raw/${TEST_PREFIX}/${hoSoId}`;

    try {
        const [folder] = await db.insert(folders).values({
            folderPath,
            folderName: hoSoId,
        }).returning();

        const [dossier] = await db.insert(dossiers).values({
            folderId: folder.id,
            folderPath,
            name: hoSoId,
            entityType: EntityType.DOCUMENT,
            status: DossierStatus.OCR_PROCESSING,
        }).returning();

        await t.step("handleMinioWebhook updates dossier to READY_FOR_ENTRY", async () => {
            const result = await handleMinioWebhook(buildMinioPayload(outputPath));

            assertEquals(result.processed, 1);
            assertEquals(result.results[0]?.status, "ok");
            if (result.results[0]?.status !== "ok") {
                throw new Error("Expected ok webhook result");
            }
            assertEquals(result.results[0].dossierId, dossier.id);
            assertEquals(result.results[0].dossierStatus, DossierStatus.READY_FOR_ENTRY);

            const updated = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, dossier.id),
            });
            assertExists(updated);
            assertEquals(updated.status, DossierStatus.READY_FOR_ENTRY);
            assertEquals(updated.ocrMetadataKey, outputPath);
            assertEquals(updated.currentMetadataKey, outputPath);
        });

        await t.step("handleMinioWebhook is idempotent for same output_path", async () => {
            const result = await handleMinioWebhook(buildMinioPayload(outputPath));

            assertEquals(result.processed, 1);
            assertEquals(result.results[0]?.status, "ok");
            if (result.results[0]?.status !== "ok") {
                throw new Error("Expected ok webhook result");
            }
            assertEquals(result.results[0].skipped, true);
        });

        await t.step("handleOcrCallback idempotency skips duplicate output_path", async () => {
            const result = await handleOcrCallback({
                ho_so_id: hoSoId,
                output_path: outputPath,
            });
            assertEquals(result.skipped, true);
            assertEquals(result.status, DossierStatus.READY_FOR_ENTRY);
        });

        if (WEBHOOK_SECRET) {
            await t.step("POST /internal/minio-webhook accepts Bearer token", async () => {
                const response = await testApp.handle(
                    new Request("http://localhost/api/v1/internal/minio-webhook", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${WEBHOOK_SECRET}`,
                        },
                        body: JSON.stringify(buildMinioPayload(outputPath)),
                    }),
                );

                assertEquals(response.status, 200);
                const body = await response.json();
                assertEquals(body.status, "ok");
                assertEquals(body.processed, 1);
            });

            await t.step("POST /internal/minio-webhook rejects invalid token", async () => {
                const response = await testApp.handle(
                    new Request("http://localhost/api/v1/internal/minio-webhook", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: "Bearer invalid-token",
                        },
                        body: JSON.stringify(buildMinioPayload(outputPath)),
                    }),
                );

                assertEquals(response.status, 401);
            });
        }
    } finally {
        await cleanup(folderPath);
    }
    },
});
