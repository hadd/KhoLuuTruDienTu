/**
 * Shared concurrency helpers for export / watermark pipelines.
 * Keeps S3 downloads and CPU-heavy PDF work from exploding memory.
 */

export const MAX_EXPORT_FILES = 500;
export const EXPORT_DOWNLOAD_CONCURRENCY = 5;
export const EXPORT_DOSSIER_CONCURRENCY = 5;

export async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length) return;
            results[index] = await fn(items[index]!, index);
        }
    }

    const workerCount = Math.min(Math.max(1, concurrency), Math.max(items.length, 1));
    if (items.length === 0) return results;
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

/** Process items in sequential batches of `batchSize` (each batch runs in parallel). */
export async function mapInBatches<T, R>(
    items: T[],
    batchSize: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const size = Math.max(1, batchSize);
    const results: R[] = [];
    for (let i = 0; i < items.length; i += size) {
        const batch = items.slice(i, i + size);
        const batchResults = await Promise.all(
            batch.map((item, offset) => fn(item, i + offset)),
        );
        results.push(...batchResults);
    }
    return results;
}
