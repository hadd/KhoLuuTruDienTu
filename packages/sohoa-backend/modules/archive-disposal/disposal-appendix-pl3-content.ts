import {
    PL3_FORMATION_FIELD_LABELS,
    PL3_REQUIRED_FORMATION_KEYS,
    type Pl3Content,
} from "./disposal-appendix-pl3-types.ts";

export function emptyPl3Content(): Pl3Content {
    return {
        creatingAgency: "",
        formationMission: "",
        collectionSource: "",
        timePeriod: "",
        expiryDuplicateReason: "",
        priorValuation: "",
        countsDetail: "",
        timeRangeText: "",
        expiredGroupSummary: "",
        duplicateGroupSummary: "",
        otherGroupSummary: "",
    };
}

export function listPl3ContentValidationErrors(content: Pl3Content): string[] {
    const errors: string[] = [];
    for (const key of PL3_REQUIRED_FORMATION_KEYS) {
        if (!content[key]?.trim()) {
            errors.push(PL3_FORMATION_FIELD_LABELS[key]);
        }
    }
    return errors;
}

export function formatPl3FormationBody(content: Pl3Content): string {
    return PL3_REQUIRED_FORMATION_KEYS
        .map((key) => `- ${content[key].trim()}`)
        .join("\n");
}

export function formatPl3FormationHeading(content: Pl3Content): string {
    return `1. Sự hình thành khối tài liệu hết thời hạn lưu trữ, trùng lặp\n${formatPl3FormationBody(content)}`;
}

export function formatPl3ExpiredGroupBlock(content: Pl3Content): string {
    return `1. Nhóm tài liệu hết thời hạn lưu trữ:\n${content.expiredGroupSummary.trim()}`;
}

export function formatPl3OtherGroupBlock(content: Pl3Content): string {
    return `3. Các nhóm tài liệu khác (nếu có):\n${content.otherGroupSummary.trim()}`;
}

export function mapPl3ContentToDocxData(
    fondName: string,
    circularLabel: string,
    content: Pl3Content,
): Record<string, string> {
    return {
        fondName,
        circularLabel,
        formationHeading: formatPl3FormationHeading(content),
        countsHeading: `2. Số lượng tài liệu:\n${content.countsDetail.trim()}`,
        timeRangeText: content.timeRangeText.trim(),
        expiredGroupSummary: formatPl3ExpiredGroupBlock(content),
        duplicateGroupHeading: "2. Nhóm tài liệu trùng lặp",
        duplicateGroupSummary: content.duplicateGroupSummary.trim(),
        otherGroupSummary: formatPl3OtherGroupBlock(content),
    };
}
