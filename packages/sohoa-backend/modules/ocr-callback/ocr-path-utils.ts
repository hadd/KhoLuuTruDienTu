import { env } from "../../env.ts";

export const PROCESSED_PREFIX = "processed/";

/**
 * Derive the dossier folderPath from the MinIO output_path produced by the
 * Python metadata worker.
 *
 * Convention:
 *   output_path  = "processed/<root_folder>/<ho_so_id>.json"
 *   folderPath   = "<rawPrefix>/<root_folder>/<ho_so_id>"
 */
export function deriveFolderPath(outputPath: string): string {
    const rawPrefix = env.STORAGE_RAW_PREFIX ?? "raw";
    return (
        rawPrefix +
        "/" +
        outputPath.replace(/^processed\//, "").replace(/\.json$/, "")
    );
}

export function deriveHoSoId(outputPath: string): string {
    const parts = outputPath
        .replace(/^processed\//, "")
        .replace(/\.json$/, "")
        .split("/");
    return parts[parts.length - 1];
}

export function isOcrMetadataKey(key: string): boolean {
    return key.startsWith(PROCESSED_PREFIX) && key.endsWith(".json");
}
