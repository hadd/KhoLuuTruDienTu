import { env } from "../../env.ts";
import { parseMinioObjectCreatedKeys } from "./minio-event.parser.ts";
import { deriveHoSoId } from "./ocr-path-utils.ts";
import { handleOcrCallback } from "./ocr-callback-service.ts";

export type MinioWebhookItemResult =
    | { output_path: string; status: "ok"; dossierId: string; dossierStatus: string; skipped?: boolean }
    | { output_path: string; status: "not_found" }
    | { output_path: string; status: "error"; message: string };

export async function handleMinioWebhook(payload: unknown): Promise<{
    processed: number;
    results: MinioWebhookItemResult[];
}> {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw new Error("S3 bucket is not configured");
    }

    const outputPaths = parseMinioObjectCreatedKeys(payload, bucket);
    const results: MinioWebhookItemResult[] = [];

    for (const output_path of outputPaths) {
        const ho_so_id = deriveHoSoId(output_path);

        try {
            const result = await handleOcrCallback({ ho_so_id, output_path });
            results.push({
                output_path,
                status: "ok",
                dossierId: result.dossierId,
                dossierStatus: result.status,
                skipped: result.skipped,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes("not found")) {
                console.warn(`[MinIO Webhook] Dossier not found for output_path: ${output_path}`);
                results.push({ output_path, status: "not_found" });
                continue;
            }

            console.error(`[MinIO Webhook] Failed to process ${output_path}:`, err);
            results.push({ output_path, status: "error", message });
        }
    }

    return { processed: results.length, results };
}
