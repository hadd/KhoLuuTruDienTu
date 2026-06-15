export type FieldChanges = Record<string, { old: string | null; new: string | null }>;

/** Actions recorded even without a field diff (e.g. first OCR baseline, restore). */
const ACTIONS_ALWAYS_RECORD = new Set(["OCR_COMPLETED", "RESTORE_VERSION"]);

export function shouldRecordMetadataSnapshot(input: {
    action: string;
    fieldChanges: FieldChanges | null;
    diffComputed: boolean;
}): boolean {
    if (ACTIONS_ALWAYS_RECORD.has(input.action)) {
        return true;
    }
    return input.diffComputed && input.fieldChanges !== null;
}
