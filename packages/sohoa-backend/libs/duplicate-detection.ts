import type { DuplicateDetectionRuleKeyType } from "../db/schemas/archive-disposal-constants.ts";

export type DuplicateCandidateRecord = {
    dossierId: string;
    fondId?: string | null;
    fileId?: string | null;
    dossierName: string;
    dossierCode?: string | null;
    fileName?: string | null;
    fullMetadataText?: string | null;
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

function getTokens(text: string): Set<string> {
    return new Set(text.split(/\s+/).filter((t) => t.length > 0));
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
            if (!(groupId.startsWith("metadata-sim:") && existing.duplicateGroupId.startsWith("metadata-sim:"))) {
                existing.duplicateGroupId = groupId;
            }
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
            const key = `${normalizeComparable(record.dossierName)}|fond:${record.fondId || ""}`;
            addToGroup(buildGroupId("name", key), entityKey, "DOSSIER_NAME");
        }

        if (enabledRules.has("DOSSIER_CODE") && record.dossierCode?.trim()) {
            const key = normalizeComparable(record.dossierCode);
            addToGroup(buildGroupId("code", key), entityKey, "DOSSIER_CODE");
        }

        if (enabledRules.has("FILE_NAME_STRICT") && record.fileId && record.fileName?.trim()) {
            const fName = normalizeComparable(record.fileName);
            if (fName) {
                addToGroup(buildGroupId("file-strict", `${fName}|dossierId:${record.dossierId}`), entityKey, "FILE_NAME_STRICT");
                if (record.dossierCode?.trim()) {
                    addToGroup(buildGroupId("file-strict", `${fName}|code:${normalizeComparable(record.dossierCode)}`), entityKey, "FILE_NAME_STRICT");
                }
                if (record.dossierName.trim()) {
                    addToGroup(buildGroupId("file-strict", `${fName}|name:${normalizeComparable(record.dossierName)}|fond:${record.fondId || ""}`), entityKey, "FILE_NAME_STRICT");
                }
            }
        }
    }

    if (enabledRules.has("DOCUMENT_METADATA_SIMILARITY")) {
        const tokenizedRecords = new Map<string, Set<string>>();
        const invertedIndex = new Map<string, Set<string>>();

        for (const record of records) {
            if (record.fullMetadataText?.trim()) {
                const entityKey = record.fileId ? `file:${record.fileId}` : `dossier:${record.dossierId}`;
                const tokens = getTokens(normalizeComparable(record.fullMetadataText));
                if (tokens.size > 0) {
                    tokenizedRecords.set(entityKey, tokens);
                    for (const token of tokens) {
                        let list = invertedIndex.get(token);
                        if (!list) {
                            list = new Set();
                            invertedIndex.set(token, list);
                        }
                        list.add(entityKey);
                    }
                }
            }
        }

        const processedPairs = new Set<string>();

        for (const [entityKey, tokens] of tokenizedRecords.entries()) {
            const candidateCounts = new Map<string, number>();
            for (const token of tokens) {
                const matchedEntities = invertedIndex.get(token);
                if (matchedEntities) {
                    for (const match of matchedEntities) {
                        if (match !== entityKey) {
                            candidateCounts.set(match, (candidateCounts.get(match) || 0) + 1);
                        }
                    }
                }
            }

            for (const [candidateKey, intersectionSize] of candidateCounts.entries()) {
                const pairKey = [entityKey, candidateKey].sort().join("::");
                if (processedPairs.has(pairKey)) continue;
                processedPairs.add(pairKey);

                const candidateTokens = tokenizedRecords.get(candidateKey)!;
                const dice = (2 * intersectionSize) / (tokens.size + candidateTokens.size);
                
                if (dice >= 0.85) {
                    let groupId = buildGroupId("metadata-sim", pairKey);
                    const existingA = matches.get(entityKey);
                    const existingB = matches.get(candidateKey);
                    
                    if (existingA?.duplicateGroupId.startsWith("metadata-sim:")) {
                        groupId = existingA.duplicateGroupId;
                    } else if (existingB?.duplicateGroupId.startsWith("metadata-sim:")) {
                        groupId = existingB.duplicateGroupId;
                    }

                    addToGroup(groupId, entityKey, "DOCUMENT_METADATA_SIMILARITY");
                    addToGroup(groupId, candidateKey, "DOCUMENT_METADATA_SIMILARITY");
                }
            }
        }
    }

    for (const [groupId, members] of groupMembers) {
        if (members.size <= 1) {
            for (const entityKey of members) {
                const match = matches.get(entityKey);
                if (match && match.duplicateGroupId === groupId) {
                    matches.delete(entityKey);
                }
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
