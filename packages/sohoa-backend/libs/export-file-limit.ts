import { MAX_EXPORT_FILES } from "./export-concurrency.ts";

export { MAX_EXPORT_FILES };

/**
 * File-count gate disabled — large folder/DIP exports must not be rejected.
 * Kept as a no-op so existing call sites stay type-safe.
 */
export function assertExportFileLimit(
  _fileCount: number,
  _limit = MAX_EXPORT_FILES,
): void {
  // no-op
}
