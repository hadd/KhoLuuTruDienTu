import { DisposalProposalItemSource } from "../../db/schemas/archive-disposal-constants.ts";
import type { DisposalProposalItemSourceType } from "../../db/schemas/archive-disposal-constants.ts";
import type { DossierMetadata } from "../../libs/metadata-types.ts";
import type { AppendixCatalogRow } from "./disposal-appendix-docx.ts";
import { extractPl2DossierTitle } from "./disposal-appendix-metadata.ts";

export type Pl2CatalogItemRow = {
    id: string;
    dossierId: string;
    fileId: string | null;
    source: DisposalProposalItemSourceType;
    reason: string;
    notes: string;
    dossierName: string;
    fileName: string | null;
    createdAt: Date;
};

/** Extract trailing numeric part from bottom-level storage unit name (e.g. "Hộp 1" -> "1"). */
export function extractBoxNumberFromPhysicalItemName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return "";
    const trailing = trimmed.match(/(\d+)\s*$/);
    if (trailing) return String(Number.parseInt(trailing[1]!, 10));
    const anyDigits = trimmed.match(/\d+/);
    return anyDigits ? String(Number.parseInt(anyDigits[0]!, 10)) : "";
}

export function compareNumericBox(a: string, b: string): number {
    const aEmpty = !a.trim();
    const bEmpty = !b.trim();
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const aNum = Number.parseInt(a, 10);
    const bNum = Number.parseInt(b, 10);
    const aIsNum = Number.isFinite(aNum) && String(aNum) === a.trim();
    const bIsNum = Number.isFinite(bNum) && String(bNum) === b.trim();
    if (aIsNum && bIsNum) return aNum - bNum;
    if (aIsNum && !bIsNum) return -1;
    if (!aIsNum && bIsNum) return 1;
    return a.localeCompare(b, "vi");
}

function disposalReasonLabel(
    source: DisposalProposalItemSourceType,
    reason: string,
): string {
    if (source === DisposalProposalItemSource.DUPLICATE) return "Trùng lặp";
    if (
        source === DisposalProposalItemSource.EXPIRED ||
        source === DisposalProposalItemSource.EXPIRING_SOON
    ) {
        return "Hết thời hạn lưu trữ";
    }
    return reason.trim() || "Hết thời hạn lưu trữ";
}

export function buildPl2CatalogRows(
    items: Pl2CatalogItemRow[],
    metadataByDossier: Map<string, DossierMetadata | null>,
    boxByDossier: Map<string, string>,
): AppendixCatalogRow[] {
    const sorted = [...items].sort((a, b) => {
        const boxA = boxByDossier.get(a.dossierId) ?? "";
        const boxB = boxByDossier.get(b.dossierId) ?? "";
        const boxCmp = compareNumericBox(boxA, boxB);
        if (boxCmp !== 0) return boxCmp;
        const timeCmp = a.createdAt.getTime() - b.createdAt.getTime();
        if (timeCmp !== 0) return timeCmp;
        return a.id.localeCompare(b.id);
    });

    let currentBoxKey: string | null = null;
    let volume = 0;

    return sorted.map((item) => {
        const boxNumber = boxByDossier.get(item.dossierId) ?? "";
        const boxKey = boxNumber.trim() || "__none__";
        if (boxKey !== currentBoxKey) {
            currentBoxKey = boxKey;
            volume = 1;
        } else {
            volume += 1;
        }

        const title = extractPl2DossierTitle(metadataByDossier.get(item.dossierId) ?? null);
        return {
            boxNumber,
            volumeNumber: String(volume),
            title,
            disposalReasonLabel: disposalReasonLabel(item.source, item.reason),
            notes: item.notes.trim(),
        };
    });
}
