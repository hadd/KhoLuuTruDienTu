import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import { groups } from "../../db/schemas/groups.ts";
import { metadataPermissionSlots } from "../../db/schemas/metadata_permission_slot.ts";
import { parseAllowedFields } from "../../libs/metadata-field-filter.ts";
import { resolveEffectiveAllowedFields } from "../../libs/metadata-permission.ts";
import type { DossierMetadata } from "../../libs/metadata-types.ts";
import { parseFieldKeys } from "../../libs/metadata-template.ts";

export async function resolveEditorSlotFieldPatterns(
    assigneeId: string,
): Promise<string[] | null> {
    const member = await db.query.groupMembers.findFirst({
        where: and(
            eq(groupMembers.userId, assigneeId),
            eq(groupMembers.role, "editor"),
            isNull(groupMembers.expiredAt),
        ),
    });
    if (!member?.permissionSlotCode) {
        return null;
    }

    const group = await db.query.groups.findFirst({
        where: eq(groups.id, member.groupId),
        columns: { metadataPermissionConfigId: true },
    });
    if (!group?.metadataPermissionConfigId) {
        return null;
    }

    const slot = await db.query.metadataPermissionSlots.findFirst({
        where: and(
            eq(metadataPermissionSlots.configId, group.metadataPermissionConfigId),
            eq(metadataPermissionSlots.slotCode, member.permissionSlotCode),
        ),
        columns: { fieldKeys: true },
    });
    if (!slot) {
        return null;
    }

    return parseFieldKeys(slot.fieldKeys);
}

export { resolveEffectiveAllowedFields } from "../../libs/metadata-permission.ts";

export async function resolveMakerAllowedFieldsForDossier(input: {
    assigneeId: string;
    storedAllowedFieldsJson: string | null | undefined;
    dossierMetadata: DossierMetadata | null;
}): Promise<string[] | null> {
    const stored = parseAllowedFields(input.storedAllowedFieldsJson);
    if (stored === null) {
        return null;
    }

    const slotPatterns = await resolveEditorSlotFieldPatterns(input.assigneeId);
    return resolveEffectiveAllowedFields(stored, slotPatterns, input.dossierMetadata);
}
