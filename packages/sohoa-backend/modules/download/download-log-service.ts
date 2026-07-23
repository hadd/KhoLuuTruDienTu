import { db } from "../../db/db-conn.ts";
import {
    downloadLogs,
    type DownloadExportType,
    type DownloadScope,
} from "../../db/schemas/download-log.ts";
import { logApi } from "@shared/common-lib";

export type RecordDownloadLogInput = {
    userId: string;
    exportType: DownloadExportType;
    scope: DownloadScope;
    resourceIds: Record<string, unknown>;
    applyWatermark: boolean;
    placementId?: string | null;
    success: boolean;
    errorMessage?: string | null;
    ip?: string | null;
    userAgent?: string | null;
};

export const DownloadLogService = {
    async record(input: RecordDownloadLogInput): Promise<void> {
        try {
            await db.insert(downloadLogs).values({
                userId: input.userId,
                exportType: input.exportType,
                scope: input.scope,
                resourceIds: input.resourceIds,
                applyWatermark: input.applyWatermark,
                placementId: input.placementId ?? null,
                success: input.success,
                errorMessage: input.errorMessage ?? null,
                ip: input.ip ?? null,
                userAgent: input.userAgent ?? null,
            });
        } catch (err) {
            // Never fail the download because logging failed.
            logApi.error({ err, userId: input.userId }, "[download-log] Failed to record");
        }
    },
};

export function clientMetaFromRequest(request: Request): {
    ip: string | null;
    userAgent: string | null;
} {
    const ua = request.headers.get("user-agent");
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? request.headers.get("x-real-ip");
    return { ip: ip ?? null, userAgent: ua };
}

export function downloadErrorMessage(err: unknown): string {
    if (err && typeof err === "object" && "message" in err) {
        const msg = String((err as { message?: unknown }).message ?? "");
        return msg.slice(0, 500) || "Unknown error";
    }
    return "Unknown error";
}

/**
 * Run an export and always write a download_logs row (success or failure).
 */
export async function withDownloadLog<T>(
    input: Omit<RecordDownloadLogInput, "success" | "errorMessage">,
    fn: () => Promise<T>,
): Promise<T> {
    try {
        const result = await fn();
        await DownloadLogService.record({ ...input, success: true });
        return result;
    } catch (err) {
        await DownloadLogService.record({
            ...input,
            success: false,
            errorMessage: downloadErrorMessage(err),
        });
        throw err;
    }
}
