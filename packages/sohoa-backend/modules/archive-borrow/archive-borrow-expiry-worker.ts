import { logApi } from "@shared/common-lib";
import { ArchiveBorrowService } from "./archive-borrow-service.ts";

let expiryTimer: ReturnType<typeof setInterval> | null = null;
let missingTableWarned = false;

function isUndefinedTableError(err: unknown): boolean {
    const code =
        (err as { code?: string; cause?: { code?: string } })?.code ??
        (err as { cause?: { code?: string } })?.cause?.code;
    const message = err instanceof Error ? err.message : String(err);
    return (
        code === "42P01" ||
        (message.includes("does not exist") &&
            message.includes("archive_borrow_requests"))
    );
}

export function startArchiveBorrowExpiryWorker(intervalMs: number): void {
    if (expiryTimer) {
        return;
    }

    const run = async () => {
        try {
            const result = await ArchiveBorrowService.expireDueRequests();
            if (result.expiredCount > 0) {
                logApi.info(
                    { result },
                    "[ArchiveBorrowExpiry] Expired borrow requests",
                );
            }
            missingTableWarned = false;
        } catch (err) {
            if (isUndefinedTableError(err)) {
                if (!missingTableWarned) {
                    missingTableWarned = true;
                    logApi.warn(
                        { err },
                        "[ArchiveBorrowExpiry] archive_borrow_requests missing — run migration/apply-borrow-0043 (will retry silently)",
                    );
                }
                return;
            }
            logApi.error({ err }, "[ArchiveBorrowExpiry] Scheduled expire failed");
        }
    };

    expiryTimer = setInterval(() => {
        run().catch(() => undefined);
    }, intervalMs);

    run().catch(() => undefined);
}

export function stopArchiveBorrowExpiryWorker(): void {
    if (expiryTimer) {
        clearInterval(expiryTimer);
        expiryTimer = null;
    }
}
