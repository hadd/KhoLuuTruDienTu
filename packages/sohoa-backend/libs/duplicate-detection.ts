import type { DuplicateDetectionRuleKeyType } from "../db/schemas/archive-disposal-constants.ts";

export type DuplicateCandidateRecord = {
    dossierId: string;
    fileId?: string | null;
    dossierName: string;
    hoSoId?: string | null;
    dossierCode?: string | null;
    fileName?: string | null;
    fileSizeKb?: number | null;
};

export type DuplicateMatch = {
    duplicateGroupId: string;
    duplicateCriteria: DuplicateDetectionRuleKeyType[];
    duplicatePeerCount: number;
};

function normalizeComparable(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

function buildGroupId(prefix: string, key: string): string {
    return `${prefix}:${key}`;
}

export function detectDuplicateMatches(
    records: DuplicateCandidateRecord[],
    enabledRules: Set<DuplicateDetectionRuleKeyType>,
    dossierCodeFieldKey?: string | null,
): Map<string, DuplicateMatch> {
    const matches = new Map<string, DuplicateMatch>();
    const groupMembers = new Map<string, Set<string>>();

    function addToGroup(groupId: string, entityKey: string, criterion: DuplicateDetectionRuleKeyType) {
        let members = groupMembers.get(groupId);
        if (!members) {
            members = new Set();
            groupMembers.set(groupId, members);
        }
        members.add(entityKey);

        const existing = matches.get(entityKey);
        if (existing) {
            if (!existing.duplicateCriteria.includes(criterion)) {
                existing.duplicateCriteria.push(criterion);
            }
            existing.duplicateGroupId = groupId;
        } else {
            matches.set(entityKey, {
                duplicateGroupId: groupId,
                duplicateCriteria: [criterion],
                duplicatePeerCount: 0,
            });
        }
    }

    for (const record of records) {
        const entityKey = record.fileId
            ? `file:${record.fileId}`
            : `dossier:${record.dossierId}`;

        if (enabledRules.has("DOSSIER_NAME") && record.dossierName.trim()) {
            const key = normalizeComparable(record.dossierName);
            if (key) {
                addToGroup(buildGroupId("name", key), entityKey, "DOSSIER_NAME");
            }
        }

        if (enabledRules.has("HO_SO_ID") && record.hoSoId?.trim()) {
            const key = normalizeComparable(record.hoSoId);
            if (key) {
                addToGroup(buildGroupId("hoso", key), entityKey, "HO_SO_ID");
            }
        }

        if (enabledRules.has("DOSSIER_CODE") && dossierCodeFieldKey) {
            const code = record.dossierCode?.trim();
            if (code) {
                const key = normalizeComparable(code);
                if (key) {
                    addToGroup(buildGroupId("code", key), entityKey, "DOSSIER_CODE");
                }
            }
        }

        if (
            enabledRules.has("FILE_NAME_SIZE") &&
            record.fileId &&
            record.fileName?.trim() &&
            record.fileSizeKb != null
        ) {
            const key = `${normalizeComparable(record.fileName)}|${record.fileSizeKb}`;
            addToGroup(buildGroupId("file", key), entityKey, "FILE_NAME_SIZE");
        }
    }

    for (const [groupId, members] of groupMembers) {
        if (members.size <= 1) {
            for (const entityKey of members) {
                matches.delete(entityKey);
            }
            continue;
        }
        for (const entityKey of members) {
            const match = matches.get(entityKey);
            if (match && match.duplicateGroupId === groupId) {
                match.duplicatePeerCount = members.size - 1;
            }
        }
    }

    return matches;
}

export function extractDossierCodeFromFieldValues(
    fieldValues: Record<string, unknown> | null | undefined,
    fieldKey?: string | null,
): string | null {
    if (!fieldValues || !fieldKey?.trim()) return null;
    const value = fieldValues[fieldKey.trim()];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
