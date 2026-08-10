export type MergeFondIdsFailureCode =
    | "MISSING_FOND"
    | "MIXED_FOND"
    | "CATALOG_MIXED_FOND";

export type MergeFondIdsResult =
    | { ok: true; fondId: string }
    | { ok: false; code: MergeFondIdsFailureCode };

/** Pure: validate existing catalog fond ids + incoming dossier fond ids resolve to one fond. */
export function mergeFondIds(
    existingCatalogFondIds: string[],
    incomingDossierFondIds: Array<string | null | undefined>,
): MergeFondIdsResult {
    const incoming = incomingDossierFondIds
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id));

    if (incoming.length !== incomingDossierFondIds.length) {
        return { ok: false, code: "MISSING_FOND" };
    }

    const incomingSet = new Set(incoming);
    if (incomingSet.size > 1) {
        return { ok: false, code: "MIXED_FOND" };
    }

    const existing = existingCatalogFondIds
        .map((id) => id.trim())
        .filter(Boolean);
    const existingSet = new Set(existing);
    if (existingSet.size > 1) {
        return { ok: false, code: "CATALOG_MIXED_FOND" };
    }

    const incomingFond = incomingSet.size === 1 ? [...incomingSet][0]! : null;
    const existingFond = existingSet.size === 1 ? [...existingSet][0]! : null;

    if (existingFond && incomingFond && existingFond !== incomingFond) {
        return { ok: false, code: "MIXED_FOND" };
    }

    const fondId = incomingFond ?? existingFond;
    if (!fondId) {
        return { ok: false, code: "MISSING_FOND" };
    }

    return { ok: true, fondId };
}

export function mergeFailureMessage(
    code: MergeFondIdsFailureCode,
    catalogFondName?: string | null,
): string {
    switch (code) {
        case "MISSING_FOND":
            return "Hồ sơ chưa gán phông, không thể đưa vào danh mục đề xuất hủy";
        case "MIXED_FOND":
            if (catalogFondName?.trim()) {
                return `Danh mục chỉ chứa hồ sơ phông ${catalogFondName.trim()}, không thể thêm hồ sơ phông khác`;
            }
            return "Chỉ được chọn hồ sơ cùng một phông trong một lần thêm";
        case "CATALOG_MIXED_FOND":
            return "Danh mục đang chứa hồ sơ thuộc nhiều phông; cần tách danh mục trước khi thêm mới";
    }
}
