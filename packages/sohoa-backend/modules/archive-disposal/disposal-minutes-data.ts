import { and, eq, inArray } from "drizzle-orm";
import { httpError } from "@shared/common-lib";

import { db } from "../../db/db-conn.ts";
import {
    disposalProposalCatalogs,
    disposalProposalItems,
    disposalReviewCouncilItemEvaluations,
    disposalReviewCouncilMembers,
    disposalReviewCouncils,
} from "../../db/schemas/archive-disposal.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";

import { DisposalCouncilService } from "./disposal-council-service.ts";
import { resolveEvaluationUnitIds } from "./disposal-evaluation-units.ts";
import type {
    CouncilMinutesMemberEvaluation,
    CouncilMinutesOutcomeRow,
} from "./disposal-minutes-pdf.ts";

export async function buildMinutesPdfData(catalogId: string, councilId: string) {
    const [catalog] = await db.select({
        code: disposalProposalCatalogs.code,
        name: disposalProposalCatalogs.name,
    })
        .from(disposalProposalCatalogs)
        .where(eq(disposalProposalCatalogs.id, catalogId))
        .limit(1);
    if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");

    const councilDetail = await DisposalCouncilService.getCouncil(councilId);
    const evalData = await DisposalCouncilService.listCouncilEvaluations(councilId);

    const members = await db.select({
        fullName: userProfiles.fullName,
        positionRole: disposalReviewCouncilMembers.positionRole,
        excusedAbsent: disposalReviewCouncilMembers.excusedAbsent,
    })
        .from(disposalReviewCouncilMembers)
        .innerJoin(userProfiles, eq(userProfiles.id, disposalReviewCouncilMembers.userId))
        .where(eq(disposalReviewCouncilMembers.councilId, councilId));

    const positionLabel = (role: string) => {
        if (role === "CHAIR") return "Chủ tịch";
        if (role === "SECRETARY") return "Thư ký";
        return "Thành viên";
    };

    const catalogItems = await db.select({
        id: disposalProposalItems.id,
        dossierId: disposalProposalItems.dossierId,
        fileId: disposalProposalItems.fileId,
    })
        .from(disposalProposalItems)
        .where(eq(disposalProposalItems.catalogId, catalogId));

    const dossierIds = [...new Set(catalogItems.map((i) => i.dossierId))];
    const dossierRows = dossierIds.length > 0
        ? await db.select({ id: dossiers.id, name: dossiers.name })
            .from(dossiers)
            .where(inArray(dossiers.id, dossierIds))
        : [];
    const dossierNameById = new Map(dossierRows.map((d) => [d.id, d.name]));

    const fileIds = catalogItems.map((i) => i.fileId).filter(Boolean) as string[];
    const fileRows = fileIds.length > 0
        ? await db.select({ id: dossierFiles.id, fileName: dossierFiles.fileName })
            .from(dossierFiles)
            .where(inArray(dossierFiles.id, fileIds))
        : [];
    const fileNameById = new Map(fileRows.map((f) => [f.id, f.fileName]));

    const unitLabel = (itemId: string) => {
        const item = catalogItems.find((i) => i.id === itemId)!;
        const dossierName = dossierNameById.get(item.dossierId) ?? item.dossierId;
        return item.fileId
            ? `${dossierName} / ${fileNameById.get(item.fileId) ?? item.fileId}`
            : dossierName;
    };

    const outcomeByItem = new Map(evalData.outcomes.map((o) => [o.itemId, o]));
    const unitIds = resolveEvaluationUnitIds(catalogItems);
    const outcomes: CouncilMinutesOutcomeRow[] = unitIds.map((unitId) => {
        const outcome = outcomeByItem.get(unitId);
        return {
            label: unitLabel(unitId),
            decision: outcome?.concludedDecision ?? null,
            hasDissent: outcome?.hasDissent ?? false,
            chairReason: outcome?.chairReason ?? null,
        };
    });

    const evaluationRows = await db.select({
        itemId: disposalReviewCouncilItemEvaluations.itemId,
        decision: disposalReviewCouncilItemEvaluations.decision,
        note: disposalReviewCouncilItemEvaluations.note,
        fullName: userProfiles.fullName,
        positionRole: disposalReviewCouncilMembers.positionRole,
    })
        .from(disposalReviewCouncilItemEvaluations)
        .innerJoin(userProfiles, eq(userProfiles.id, disposalReviewCouncilItemEvaluations.userId))
        .innerJoin(
            disposalReviewCouncilMembers,
            and(
                eq(disposalReviewCouncilMembers.councilId, councilId),
                eq(disposalReviewCouncilMembers.userId, disposalReviewCouncilItemEvaluations.userId),
            ),
        )
        .where(eq(disposalReviewCouncilItemEvaluations.councilId, councilId));

    const evaluations: CouncilMinutesMemberEvaluation[] = evaluationRows.map((row) => ({
        memberName: row.fullName,
        positionLabel: positionLabel(row.positionRole),
        itemLabel: unitLabel(row.itemId),
        decision: row.decision,
        note: row.note,
    }));

    const destroyCount = outcomes.filter((o) => o.decision === "DESTROY").length;
    const meetingDate = new Date();

    return {
        catalog,
        councilDetail,
        members: members.map((m) => ({
            fullName: m.fullName,
            positionLabel: positionLabel(m.positionRole),
            excusedAbsent: m.excusedAbsent,
        })),
        outcomes,
        evaluations,
        destroyCount,
        meetingDate,
    };
}

export async function buildMinutesPdfDataForCatalog(catalogId: string) {
    const [councilRow] = await db.select({ id: disposalReviewCouncils.id })
        .from(disposalReviewCouncils)
        .where(eq(disposalReviewCouncils.catalogId, catalogId))
        .limit(1);
    if (!councilRow) throw httpError.conflict("Danh mục chưa có Hội đồng xét hủy");
    return buildMinutesPdfData(catalogId, councilRow.id);
}
