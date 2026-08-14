import { DisposalProposalItemSource } from "../../db/schemas/archive-disposal-constants.ts";
import type { DisposalProposalItemSourceType } from "../../db/schemas/archive-disposal-constants.ts";
import type { DossierMetadata } from "../../libs/metadata-types.ts";

import {
    PL3_DEFAULT_DUPLICATE_GROUP_SUMMARY,
    PL3_DEFAULT_EXPIRED_GROUP_SUMMARY,
    PL3_DEFAULT_OTHER_GROUP_SUMMARY,
} from "./disposal-appendix-pl3-templates.ts";
import type { Pl3Content } from "./disposal-appendix-pl3-types.ts";

export type Pl3SuggestionItem = {
    dossierId: string;
    fileId: string | null;
    source: DisposalProposalItemSourceType;
};

function findExactMetadataField(metadata: DossierMetadata | null, fieldName: string): string {
    if (!metadata) return "";
    const target = fieldName.toUpperCase();
    for (const group of metadata.metadata_groups) {
        for (const field of group.fields) {
            if (field.name.toUpperCase() === target) {
                const v = field.value;
                if (v != null && String(v).trim() !== "") return String(v).trim();
            }
        }
    }
    return "";
}

export function buildPl3CountsDetail(items: Pl3SuggestionItem[]): string {
    const dossierIds = new Set(items.map((i) => i.dossierId));
    const fileRows = items.filter((i) => i.fileId != null).length;
    const expired = items.filter((i) =>
        i.source === DisposalProposalItemSource.EXPIRED ||
        i.source === DisposalProposalItemSource.EXPIRING_SOON
    ).length;
    const duplicate = items.filter((i) => i.source === DisposalProposalItemSource.DUPLICATE).length;
    return [
        `- Tổng số tài liệu đưa ra xác định lại giá trị: ${items.length} (hồ sơ: ${dossierIds.size})`,
        `- Tổng số tài liệu giấy đưa ra chỉnh lý: ${fileRows || items.length}`,
        `- Tài liệu giữ lại bảo quản: 0`,
        `- Tài liệu hết thời hạn lưu trữ, trùng lặp: ${expired + duplicate}`,
    ].join("\n");
}

function suggestTimePeriod(
    items: Pl3SuggestionItem[],
    metadataByDossier: Map<string, DossierMetadata | null>,
): string {
    const starts: string[] = [];
    const ends: string[] = [];
    const dossierIds = [...new Set(items.map((i) => i.dossierId))];
    for (const dossierId of dossierIds) {
        const meta = metadataByDossier.get(dossierId) ?? null;
        const start = findExactMetadataField(meta, "THOI_GIAN_BAT_DAU");
        const end = findExactMetadataField(meta, "THOI_GIAN_KET_THUC");
        if (start) starts.push(start);
        if (end) ends.push(end);
    }
    if (starts.length === 0 && ends.length === 0) return "";
    const minStart = starts.sort()[0];
    const maxEnd = ends.sort().at(-1);
    if (minStart && maxEnd) return `Từ ${minStart} đến ${maxEnd}`;
    if (minStart) return `Từ ${minStart}`;
    if (maxEnd) return `Đến ${maxEnd}`;
    return "";
}

function suggestTimeRangeText(
    catalogDate: string,
    timePeriod: string,
): string {
    if (timePeriod.trim()) {
        return `3. Thời gian: Thời gian bắt đầu và kết thúc của khối tài liệu hết thời hạn lưu trữ, trùng lặp: ${timePeriod.trim()}`;
    }
    return `3. Thời gian: ${catalogDate} (theo danh mục đề xuất hủy)`;
}

export function buildPl3Suggestions(input: {
    fondName: string;
    fondAgency: string;
    fondHistory: string;
    catalogCode: string;
    catalogDate: string;
    items: Pl3SuggestionItem[];
    metadataByDossier?: Map<string, DossierMetadata | null>;
}): Pl3Content {
    const metadataByDossier = input.metadataByDossier ?? new Map();
    const expired = input.items.filter((i) =>
        i.source === DisposalProposalItemSource.EXPIRED ||
        i.source === DisposalProposalItemSource.EXPIRING_SOON
    ).length;
    const duplicate = input.items.filter((i) =>
        i.source === DisposalProposalItemSource.DUPLICATE
    ).length;

    const agencyParts = [
        input.fondAgency.trim(),
        input.fondName.trim(),
    ].filter(Boolean);
    const timePeriod = suggestTimePeriod(input.items, metadataByDossier);

    return {
        creatingAgency: agencyParts.join(" — ") ||
            "Cơ quan, đơn vị quản lý phông lưu trữ liên quan.",
        formationMission: input.fondHistory.trim() ||
            "Theo quá trình hoạt động và thực hiện nhiệm vụ của cơ quan, đơn vị.",
        collectionSource:
            `Tập hợp từ kho lưu trữ, lập trong danh mục đề xuất hủy ${input.catalogCode}.`,
        timePeriod,
        expiryDuplicateReason: expired + duplicate > 0
            ? `Qua rà soát, gồm ${expired} mục hết thời hạn lưu trữ và ${duplicate} mục trùng lặp trong danh mục đề xuất hủy.`
            : "Theo kết quả rà soát và lập danh mục đề xuất hủy.",
        priorValuation:
            `Đã rà soát, lập danh mục đề xuất hủy ngày ${input.catalogDate}; trình Hội đồng thẩm tra xét hủy theo quy định.`,
        countsDetail: buildPl3CountsDetail(input.items),
        timeRangeText: suggestTimeRangeText(input.catalogDate, timePeriod),
        expiredGroupSummary: PL3_DEFAULT_EXPIRED_GROUP_SUMMARY,
        duplicateGroupSummary: PL3_DEFAULT_DUPLICATE_GROUP_SUMMARY,
        otherGroupSummary: PL3_DEFAULT_OTHER_GROUP_SUMMARY,
    };
}
