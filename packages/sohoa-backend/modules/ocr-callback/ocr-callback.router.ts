import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { handleOcrCallback } from "./ocr-callback-service.ts";

const ocrCallbackBodySchema = t.Object({
    ho_so_id: t.String({ minLength: 1, description: "Folder name / hồ sơ ID từ MinIO" }),
    output_path: t.String({
        minLength: 1,
        description: 'S3 key của file metadata tổng hợp, dạng "processed/<root>/<ho_so_id>.json"',
    }),
});

export function createOcrCallbackRouter(basePath: string = "/internal") {
    return new Elysia({ name: "ocrCallbackRouter", prefix: basePath })
        .use(plugins.authInternalApi)
        .post(
            "/ocr-callback",
            async ({ body }) => {
                const result = await handleOcrCallback(body);
                return { acknowledged: true, ...result };
            },
            {
                body: ocrCallbackBodySchema,
                detail: {
                    tags: ["Internal"],
                    summary: "OCR metadata callback",
                    description:
                        "Called by the Python metadata worker after OCR processing is complete. " +
                        "Updates dossier.ocr_metadata_key and advances status to READY_FOR_ENTRY. " +
                        "Requires X-API-Key header.",
                },
            },
        );
}
