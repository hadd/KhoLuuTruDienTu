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
    // Track group membership: groupId → Set of entityKeys
    const groupMembers = new Map<string, Set<string>>();
    // Track criterion per group: groupId → criterion
    const groupCriterion = new Map<string, DuplicateDetectionRuleKeyType>();

    function addToGroup(groupId: string, entityKey: string, criterion: DuplicateDetectionRuleKeyType) {
        let members = groupMembers.get(groupId);
        if (!members) {
            members = new Set();
            groupMembers.set(groupId, members);
            groupCriterion.set(groupId, criterion);
        }
        members.add(entityKey);
    }

    for (const record of records) {
        const entityKey = record.fileId
            ? `file:${record.fileId}`
            : `dossier:${record.dossierId}`;

        // Dossier-only criteria
        if (!record.fileId) {
            if (enabledRules.has("DOSSIER_NAME") && record.dossierName.trim()) {
                const key = `${normalizeComparable(record.dossierName)}|fond:${record.fondId || ""}`;
                addToGroup(buildGroupId("name", key), entityKey, "DOSSIER_NAME");
            }

            if (enabledRules.has("DOSSIER_CODE") && record.dossierCode?.trim()) {
                const key = normalizeComparable(record.dossierCode);
                addToGroup(buildGroupId("code", key), entityKey, "DOSSIER_CODE");
            }
        }

        // File-only criteria
        if (record.fileId) {
            if (enabledRules.has("FILE_NAME_STRICT") && record.fileName?.trim()) {
                const fName = normalizeComparable(record.fileName);
                if (fName) {
                    // Match files with same name across DIFFERENT dossiers in same fond
                    addToGroup(buildGroupId("file-strict", `${fName}|fond:${record.fondId || ""}`), entityKey, "FILE_NAME_STRICT");
                }
            }
        }
    }

    if (enabledRules.has("DOCUMENT_METADATA_SIMILARITY")) {
        const tokenizedRecords = new Map<string, { tokens: Set<string>; dossierId: string }>();
        const invertedIndex = new Map<string, Set<string>>();

        for (const record of records) {
            if (record.fullMetadataText?.trim()) {
                const entityKey = record.fileId ? `file:${record.fileId}` : `dossier:${record.dossierId}`;
                const tokens = getTokens(normalizeComparable(record.fullMetadataText));
                if (tokens.size > 0) {
                    tokenizedRecords.set(entityKey, { tokens, dossierId: record.dossierId });
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

        for (const [entityKey, data] of tokenizedRecords.entries()) {
            const candidateCounts = new Map<string, number>();
            for (const token of data.tokens) {
                const matchedEntities = invertedIndex.get(token);
                if (matchedEntities) {
                    for (const match of matchedEntities) {
                        if (match !== entityKey) {
                            const matchData = tokenizedRecords.get(match);
                            // Only compare entities from DIFFERENT dossiers
                            if (matchData && matchData.dossierId !== data.dossierId) {
                                candidateCounts.set(match, (candidateCounts.get(match) || 0) + 1);
                            }
                        }
                    }
                }
            }

            for (const [candidateKey, intersectionSize] of candidateCounts.entries()) {
                const pairKey = [entityKey, candidateKey].sort().join("::");
                if (processedPairs.has(pairKey)) continue;
                processedPairs.add(pairKey);

                const candidateData = tokenizedRecords.get(candidateKey)!;
                const dice = (2 * intersectionSize) / (data.tokens.size + candidateData.tokens.size);
                
                if (dice >= 0.85) {
                    addToGroup(buildGroupId("metadata-sim", pairKey), entityKey, "DOCUMENT_METADATA_SIMILARITY");
                    addToGroup(buildGroupId("metadata-sim", pairKey), candidateKey, "DOCUMENT_METADATA_SIMILARITY");
                }
            }
        }
    }

    // Build final matches from ONLY groups that have >= 2 members.
    // Criteria are derived per-group AFTER filtering, so singleton groups
    // never contribute criteria to the final output.
    const matches = new Map<string, DuplicateMatch>();

    for (const [groupId, members] of groupMembers.entries()) {
        if (members.size < 2) continue; // Singleton groups: skip entirely

        const criterion = groupCriterion.get(groupId)!;

        for (const entityKey of members) {
            const existing = matches.get(entityKey);
            if (existing) {
                if (!existing.duplicateCriteria.includes(criterion)) {
                    existing.duplicateCriteria.push(criterion);
                }
                existing.duplicatePeerCount = Math.max(existing.duplicatePeerCount, members.size - 1);
                // Keep the most specific group as the primary groupId
                if (
                    existing.duplicateGroupId.startsWith("metadata-sim:") &&
                    !groupId.startsWith("metadata-sim:")
                ) {
                    existing.duplicateGroupId = groupId;
                }
            } else {
                matches.set(entityKey, {
                    duplicateGroupId: groupId,
                    duplicateCriteria: [criterion],
                    duplicatePeerCount: members.size - 1,
                });
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
