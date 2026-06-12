export type FieldSplitEditorRef = {
    userId: string;
    fullName: string | null;
    allowedFields: string[];
    permissionSlotCode: string;
    slotSortOrder: number;
};

export type PermissionSlotEditorGroup = {
    slotCode: string;
    sortOrder: number;
    editors: FieldSplitEditorRef[];
};

export function groupEditorsByPermissionSlot(
    editors: FieldSplitEditorRef[],
): PermissionSlotEditorGroup[] {
    const bySlot = new Map<string, FieldSplitEditorRef[]>();

    for (const editor of editors) {
        const existing = bySlot.get(editor.permissionSlotCode) ?? [];
        existing.push(editor);
        bySlot.set(editor.permissionSlotCode, existing);
    }

    return [...bySlot.entries()]
        .map(([slotCode, slotEditors]) => ({
            slotCode,
            sortOrder: Math.min(...slotEditors.map((e) => e.slotSortOrder)),
            editors: [...slotEditors].sort((a, b) => a.userId.localeCompare(b.userId)),
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.slotCode.localeCompare(b.slotCode));
}

/**
 * Pick one editor per permission slot for a dossier (round-robin within each slot).
 * dossierOrdinal 0 → first editor in each slot; 1 → second in each slot; etc.
 */
export function pickEditorsForFieldSplitDossier(
    slotGroups: PermissionSlotEditorGroup[],
    dossierOrdinal: number,
): FieldSplitEditorRef[] {
    return slotGroups.map((group) => {
        const index = dossierOrdinal % group.editors.length;
        return group.editors[index]!;
    });
}

export function toFieldSplitEditors(
    editors: Array<{
        userId: string;
        fullName: string | null;
        allowedFields: string[] | null;
        permissionSlotCode?: string | null;
        slotSortOrder?: number;
    }>,
): FieldSplitEditorRef[] {
    return editors.flatMap((editor) => {
        if (
            !editor.allowedFields
            || !editor.permissionSlotCode
        ) {
            return [];
        }
        return [{
            userId: editor.userId,
            fullName: editor.fullName,
            allowedFields: editor.allowedFields,
            permissionSlotCode: editor.permissionSlotCode,
            slotSortOrder: editor.slotSortOrder ?? 0,
        }];
    });
}
