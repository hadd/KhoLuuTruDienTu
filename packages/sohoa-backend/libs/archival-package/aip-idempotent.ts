import type { StorageObjectStat } from "../archival-storage.ts";

/** Idempotent guard: WORM objects cannot be overwritten. */
export function shouldSkipExistingAip(stat: StorageObjectStat): boolean {
    return stat.exists;
}
