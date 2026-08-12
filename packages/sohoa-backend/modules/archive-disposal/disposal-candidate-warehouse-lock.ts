import { httpError } from "@shared/common-lib";

import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import {
    resolveDisposalCandidateWarehouseLockScope,
} from "./archive-disposal-service.ts";

export const DISPOSAL_CANDIDATE_WAREHOUSE_LOCK_MESSAGE =
    "Hồ sơ hoặc tài liệu thuộc danh sách hết hạn/trùng lặp — chỉ được xử lý hủy theo quy trình Hội đồng xét hủy";

export async function isDisposalCandidateWarehouseLocked(input: {
    profile: UserWithRoles;
    dossierId: string;
    fileId?: string | null;
}): Promise<boolean> {
    const scope = await resolveDisposalCandidateWarehouseLockScope(
        input.profile,
        input.dossierId,
    );
    if (!scope) return false;

    if (input.fileId?.trim()) {
        const fileId = input.fileId.trim();
        return scope.dossierLocked || scope.lockedFileIds.has(fileId);
    }

    return scope.dossierLocked || scope.lockedFileIds.size > 0;
}

export async function assertDisposalCandidateWarehouseUnlocked(input: {
    profile: UserWithRoles;
    dossierId: string;
    fileId?: string | null;
}): Promise<void> {
    const locked = await isDisposalCandidateWarehouseLocked(input);
    if (locked) {
        throw httpError.conflict(DISPOSAL_CANDIDATE_WAREHOUSE_LOCK_MESSAGE);
    }
}

export async function applyDisposalCandidateLockToWarehouseActions(
    profile: UserWithRoles,
    dossierId: string,
    actions: {
        edit: boolean;
        delete: boolean;
        reupload: boolean;
    },
): Promise<void> {
    const scope = await resolveDisposalCandidateWarehouseLockScope(
        profile,
        dossierId,
    );
    if (!scope) return;

    if (scope.dossierLocked || scope.lockedFileIds.size > 0) {
        actions.edit = false;
        actions.delete = false;
        actions.reupload = false;
    }
}
