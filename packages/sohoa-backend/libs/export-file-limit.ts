import { httpError } from "@shared/common-lib";
import { MAX_EXPORT_FILES } from "./export-concurrency.ts";

export { MAX_EXPORT_FILES };

export function assertExportFileLimit(fileCount: number, limit = MAX_EXPORT_FILES): void {
    if (fileCount > limit) {
        throw httpError.badRequest(
            `Export vượt quá giới hạn ${limit} file (hiện có ${fileCount} file). Vui lòng chọn ít hồ sơ hơn.`,
        );
    }
}
