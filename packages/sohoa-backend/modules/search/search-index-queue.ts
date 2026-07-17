import { logApi } from "@shared/common-lib";
import { indexDossierById } from "./adapters/dossier.adapter.ts";

const MAX_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 10 * 60_000;

type JobOp = "INDEX" | "DELETE";

type PendingJob = {
    op: JobOp;
    attempts: number;
    nextRunAt: number;
    lastError: string | null;
};

/**
 * Hàng đợi retry trong bộ nhớ (không cần bảng DB): mỗi hồ sơ giữ đúng một job
 * với op mới nhất. Job lỗi được thử lại với backoff bởi worker định kỳ.
 * Nếu backend restart làm mất job, bước đối chiếu DB khi search sẽ phát hiện
 * doc rác và enqueue xóa lại (tự chữa lành).
 */
const pendingJobs = new Map<string, PendingJob>();

function backoffDelayMs(attempts: number): number {
    return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);
}

async function executeJobOp(op: JobOp, dossierId: string): Promise<void> {
    if (op === "INDEX") {
        await indexDossierById(dossierId);
        return;
    }
    const { deleteDocument } = await import("@shared/search-engine");
    await deleteDocument("dossier", dossierId);
}

async function attemptJob(dossierId: string, job: PendingJob): Promise<boolean> {
    job.attempts += 1;
    try {
        await executeJobOp(job.op, dossierId);
        // Chỉ gỡ khỏi hàng đợi nếu không có op mới hơn được enqueue trong lúc chạy.
        if (pendingJobs.get(dossierId) === job) {
            pendingJobs.delete(dossierId);
        }
        return true;
    } catch (err) {
        job.lastError = err instanceof Error ? err.message : String(err);
        const exhausted = job.attempts >= MAX_ATTEMPTS;
        if (exhausted && pendingJobs.get(dossierId) === job) {
            pendingJobs.delete(dossierId);
        }
        job.nextRunAt = Date.now() + backoffDelayMs(job.attempts);
        logApi.error(
            { err, dossierId, op: job.op, attempts: job.attempts, exhausted },
            exhausted
                ? "[SearchIndex] Job exhausted retries and was dropped"
                : "[SearchIndex] Job failed, will retry",
        );
        return false;
    }
}

function schedule(op: JobOp, dossierId: string): void {
    // Op mới nhất thắng: INDEX sau DELETE (hoặc ngược lại) thay thế job cũ.
    const job: PendingJob = { op, attempts: 0, nextRunAt: Date.now(), lastError: null };
    pendingJobs.set(dossierId, job);
    attemptJob(dossierId, job).catch((err) => {
        logApi.error({ err, dossierId, op }, "[SearchIndex] Unexpected job error");
    });
}

export function enqueueDossierIndex(dossierId: string): void {
    schedule("INDEX", dossierId);
}

export function enqueueDossierDelete(dossierId: string): void {
    schedule("DELETE", dossierId);
}

/** Worker tick: chạy lại các job đến hạn. Trả về số job đã xử lý. */
export async function processPendingSearchIndexJobs(): Promise<number> {
    const now = Date.now();
    const due = [...pendingJobs.entries()].filter(([, job]) => job.nextRunAt <= now);
    for (const [dossierId, job] of due) {
        await attemptJob(dossierId, job);
    }
    return due.length;
}

export function getPendingSearchIndexJobCount(): number {
    return pendingJobs.size;
}

export function startSearchIndexWorker(intervalMs = 15_000): void {
    console.info(`[SearchIndex] Retry worker started (interval: ${intervalMs / 1000}s)`);
    setInterval(() => {
        processPendingSearchIndexJobs().catch((err) => {
            logApi.error({ err }, "[SearchIndex] Worker tick failed");
        });
    }, intervalMs);
}
