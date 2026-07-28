import { logApi } from "@shared/common-lib";
import { AuditLogService } from "./audit-log-service.ts";

let purgeTimer: ReturnType<typeof setInterval> | null = null;

export function startAuditLogPurgeWorker(intervalMs: number): void {
    if (purgeTimer) {
        return;
    }

    const run = async () => {
        try {
            const result = await AuditLogService.purgeExpired();
            if (result.purgedCount && result.purgedCount > 0) {
                logApi.info({ result }, "[AuditLogPurge] Completed scheduled purge");
            }
        } catch (err) {
            logApi.error({ err }, "[AuditLogPurge] Scheduled purge failed");
        }
    };

    purgeTimer = setInterval(() => {
        run().catch(() => undefined);
    }, intervalMs);

    run().catch(() => undefined);
}

export function stopAuditLogPurgeWorker(): void {
    if (purgeTimer) {
        clearInterval(purgeTimer);
        purgeTimer = null;
    }
}
