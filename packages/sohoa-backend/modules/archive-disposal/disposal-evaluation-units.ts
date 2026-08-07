export type DisposalCatalogItemRef = {
    id: string;
    dossierId: string;
    fileId: string | null;
};

/**
 * Mỗi hồ sơ trong danh mục có một trong hai chế độ:
 * - Có dòng hồ sơ (fileId null) → một đơn vị đánh giá = id dòng hồ sơ
 * - Chỉ có dòng tài liệu → mỗi dòng tài liệu là một đơn vị đánh giá
 */
export function resolveEvaluationUnitIds(
    items: Array<DisposalCatalogItemRef>,
): Array<string> {
    const byDossier = new Map<string, DisposalCatalogItemRef[]>();
    for (const item of items) {
        const list = byDossier.get(item.dossierId) ?? [];
        list.push(item);
        byDossier.set(item.dossierId, list);
    }

    const unitIds: string[] = [];
    for (const group of byDossier.values()) {
        const dossierRow = group.find((row) => row.fileId == null);
        if (dossierRow) {
            unitIds.push(dossierRow.id);
        } else {
            for (const row of group) {
                if (row.fileId != null) {
                    unitIds.push(row.id);
                }
            }
        }
    }

    return unitIds;
}
