import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { plAuthMinioWebhook } from "../../libs/plugins/auth-minio-webhook.ts";
import { handleOcrCallback } from "./ocr-callback-service.ts";
import { handleMinioWebhook } from "./minio-webhook.handler.ts";

const ocrCallbackBodySchema = t.Object({
    ho_so_id: t.String({ minLength: 1, description: "Folder name / hồ sơ ID từ MinIO" }),
    output_path: t.String({
        minLength: 1,
        description: 'S3 key của file metadata tổng hợp, dạng "processed/<root>/<ho_so_id>.json"',
    }),
});

export function createOcrCallbackRouter(basePath: string = "/internal") {
    return new Elysia({ name: "ocrCallbackRouter", prefix: basePath })
        .use(
            new Elysia()
                .use(plugins.authInternalApi)
                .post(
                    "/ocr-callback",
                    async ({ body }) => {
                        const result = await handleOcrCallback(body);
                        return {
                            status: "ok",
                            dossierId: result.dossierId,
                            folderPath: result.folderPath,
                            ocrMetadataKey: result.ocrMetadataKey,
                            dossierStatus: result.status,
                            skipped: result.skipped,
                        };
                    },
                    {
                        body: ocrCallbackBodySchema,
                        detail: {
                            tags: ["Internal"],
                            summary: "OCR metadata callback (manual/debug)",
                            description:
                                "Manual retry or debug endpoint after OCR completes. " +
                                "Primary flow is MinIO bucket webhook at POST /internal/minio-webhook. " +
                                "Updates dossier.ocr_metadata_key and advances status to READY_FOR_ENTRY. " +
                                "Requires X-API-Key header.",
                        },
                    },
                ),
        )
        .use(
            new Elysia()
                .use(plAuthMinioWebhook)
                .post(
                    "/minio-webhook",
                    async ({ body }) => {
                        const result = await handleMinioWebhook(body);
                        return { status: "ok", ...result };
                    },
                    {
                        detail: {
                            tags: ["Internal"],
                            summary: "MinIO bucket notification webhook",
                            description:
                                "Receives MinIO S3 ObjectCreated events for processed/*.json files. " +
                                "Updates dossier OCR metadata and advances status to READY_FOR_ENTRY. " +
                                "Requires Authorization: Bearer token matching MINIO_WEBHOOK_SECRET.",
                        },
                    },
                ),
        );
}
