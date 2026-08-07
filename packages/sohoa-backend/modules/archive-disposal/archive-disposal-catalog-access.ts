import { eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";

import { db } from "../../db/db-conn.ts";
import {
    disposalReviewCouncilMembers,
    disposalReviewCouncils,
} from "../../db/schemas/archive-disposal.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";

import {
    hasArchiveDisposalCouncilCreatePermission,
    hasArchiveDisposalCouncilFinalizePermission,
    hasArchiveDisposalCouncilReadPermission,
    hasArchiveDisposalCouncilUpdatePermission,
    hasArchiveDisposalManagePermission,
    hasArchiveDisposalReadPermission,
} from "./archive-disposal-permissions.ts";

export type DisposalCatalogListScope = {
    mode: "all";
} | {
    mode: "member_only";
    catalogIds: string[];
};

/** Quản lý đề xuất / điều phối Hội đồng — xem mọi danh mục. */
export function hasUnrestrictedDisposalCatalogAccess(
    profile: UserWithRoles,
): boolean {
    return hasArchiveDisposalManagePermission(profile) ||
        hasArchiveDisposalCouncilCreatePermission(profile) ||
        hasArchiveDisposalCouncilUpdatePermission(profile) ||
        hasArchiveDisposalCouncilFinalizePermission(profile);
}

export async function listCatalogIdsForCouncilMember(
    userId: string,
): Promise<string[]> {
    const rows = await db
        .selectDistinct({ catalogId: disposalReviewCouncils.catalogId })
        .from(disposalReviewCouncilMembers)
        .innerJoin(
            disposalReviewCouncils,
            eq(disposalReviewCouncils.id, disposalReviewCouncilMembers.councilId),
        )
        .where(eq(disposalReviewCouncilMembers.userId, userId));

    return rows.map((row) => row.catalogId);
}

export async function resolveDisposalCatalogListScope(
    profile: UserWithRoles,
): Promise<DisposalCatalogListScope> {
    if (hasUnrestrictedDisposalCatalogAccess(profile)) {
        return { mode: "all" };
    }

    const catalogIds = await listCatalogIdsForCouncilMember(profile.id);
    if (catalogIds.length > 0) {
        return { mode: "member_only", catalogIds };
    }

    if (
        hasArchiveDisposalReadPermission(profile) ||
        hasArchiveDisposalCouncilReadPermission(profile)
    ) {
        return { mode: "all" };
    }

    throw httpError.forbidden(
        "Không có quyền xem danh mục đề xuất hủy",
    );
}

export async function assertCanAccessDisposalCatalog(
    profile: UserWithRoles,
    catalogId: string,
): Promise<void> {
    if (hasUnrestrictedDisposalCatalogAccess(profile)) {
        return;
    }

    const memberCatalogIds = await listCatalogIdsForCouncilMember(profile.id);
    if (memberCatalogIds.includes(catalogId)) {
        return;
    }

    if (memberCatalogIds.length > 0) {
        throw httpError.forbidden(
            "Bạn chỉ được xem danh mục đề xuất hủy thuộc Hội đồng được phân công",
        );
    }

    if (
        hasArchiveDisposalReadPermission(profile) ||
        hasArchiveDisposalCouncilReadPermission(profile)
    ) {
        return;
    }

    throw httpError.forbidden("Không có quyền xem danh mục đề xuất hủy");
}
