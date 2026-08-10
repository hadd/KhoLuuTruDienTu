import { httpError } from "@shared/common-lib";
import { and, eq } from "drizzle-orm";

import { db } from "../../db/db-conn.ts";
import { DisposalCouncilMemberPositionRole } from "../../db/schemas/archive-disposal-constants.ts";
import {
    disposalProposalCatalogs,
    disposalReviewCouncilMembers,
    disposalReviewCouncils,
} from "../../db/schemas/archive-disposal.ts";

async function loadMemberPositionRole(
    councilId: string,
    userId: string,
): Promise<string | null> {
    const [row] = await db.select({
        positionRole: disposalReviewCouncilMembers.positionRole,
    })
        .from(disposalReviewCouncilMembers)
        .where(and(
            eq(disposalReviewCouncilMembers.councilId, councilId),
            eq(disposalReviewCouncilMembers.userId, userId),
        ))
        .limit(1);
    return row?.positionRole ?? null;
}

export async function assertCouncilChairPosition(
    councilId: string,
    userId: string,
): Promise<void> {
    const role = await loadMemberPositionRole(councilId, userId);
    if (role !== DisposalCouncilMemberPositionRole.CHAIR) {
        throw httpError.forbidden("Chỉ Chủ tịch Hội đồng mới được thực hiện thao tác này");
    }
}

export async function assertCouncilSecretaryPosition(
    councilId: string,
    userId: string,
): Promise<void> {
    const role = await loadMemberPositionRole(councilId, userId);
    if (role !== DisposalCouncilMemberPositionRole.SECRETARY) {
        throw httpError.forbidden("Chỉ Thư ký Hội đồng mới được thực hiện thao tác này");
    }
}

export async function assertDisposalCatalogCreator(
    councilId: string,
    userId: string,
): Promise<void> {
    const [row] = await db.select({
        catalogCreatedBy: disposalProposalCatalogs.createdBy,
    })
        .from(disposalReviewCouncils)
        .innerJoin(
            disposalProposalCatalogs,
            eq(disposalProposalCatalogs.id, disposalReviewCouncils.catalogId),
        )
        .where(eq(disposalReviewCouncils.id, councilId))
        .limit(1);
    if (!row) {
        throw httpError.notFound("Không tìm thấy Hội đồng xét hủy");
    }
    if (row.catalogCreatedBy !== userId) {
        throw httpError.forbidden(
            "Chỉ người lập danh mục đề xuất hủy mới được xuất bản Quyết định và biên bản",
        );
    }
}
