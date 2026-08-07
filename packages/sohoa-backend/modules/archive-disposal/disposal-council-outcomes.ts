import { and, eq } from "drizzle-orm";

import { db } from "../../db/db-conn.ts";
import {
    DisposalCouncilEvaluationDecision,
    type DisposalCouncilEvaluationDecisionType,
} from "../../db/schemas/archive-disposal-constants.ts";
import {
    disposalProposalItems,
    disposalReviewCouncilItemEvaluations,
    disposalReviewCouncilItemOutcomes,
    disposalReviewCouncilMembers,
    disposalReviewCouncils,
} from "../../db/schemas/archive-disposal.ts";

import { resolveEvaluationUnitIds } from "./disposal-evaluation-units.ts";

type VoteT = DisposalCouncilEvaluationDecisionType;

function majorityDecision(destroy: number, keep: number): {
    concluded: VoteT | null;
    needsChair: boolean;
    hasDissent: boolean;
} {
    if (destroy + keep === 0) {
        return { concluded: null, needsChair: false, hasDissent: false };
    }
    if (destroy === keep) {
        return { concluded: null, needsChair: true, hasDissent: true };
    }
    const concluded = destroy > keep
        ? DisposalCouncilEvaluationDecision.DESTROY
        : DisposalCouncilEvaluationDecision.KEEP;
    const unanimous = destroy === 0 || keep === 0;
    return {
        concluded,
        needsChair: false,
        hasDissent: !unanimous,
    };
}

export async function recomputeCouncilItemOutcomes(councilId: string) {
    const [council] = await db.select({ catalogId: disposalReviewCouncils.catalogId })
        .from(disposalReviewCouncils)
        .where(eq(disposalReviewCouncils.id, councilId))
        .limit(1);
    if (!council) return;

    const members = await db.select({
        userId: disposalReviewCouncilMembers.userId,
        excusedAbsent: disposalReviewCouncilMembers.excusedAbsent,
    })
        .from(disposalReviewCouncilMembers)
        .where(eq(disposalReviewCouncilMembers.councilId, councilId));

    const participatingUserIds = new Set(
        members.filter((m) => !m.excusedAbsent).map((m) => m.userId),
    );
    const participatingCount = participatingUserIds.size;

    const catalogItems = await db.select({
        id: disposalProposalItems.id,
        dossierId: disposalProposalItems.dossierId,
        fileId: disposalProposalItems.fileId,
    })
        .from(disposalProposalItems)
        .where(eq(disposalProposalItems.catalogId, council.catalogId));

    const unitIds = resolveEvaluationUnitIds(catalogItems);

    const evaluations = await db.select({
        itemId: disposalReviewCouncilItemEvaluations.itemId,
        userId: disposalReviewCouncilItemEvaluations.userId,
        decision: disposalReviewCouncilItemEvaluations.decision,
    })
        .from(disposalReviewCouncilItemEvaluations)
        .where(eq(disposalReviewCouncilItemEvaluations.councilId, councilId));

    const now = new Date();

    for (const itemId of unitIds) {
        let destroy = 0;
        let keep = 0;
        for (const evaluation of evaluations) {
            if (evaluation.itemId !== itemId) continue;
            if (!participatingUserIds.has(evaluation.userId)) continue;
            if (!evaluation.decision) continue;
            if (evaluation.decision === DisposalCouncilEvaluationDecision.DESTROY) destroy++;
            else keep++;
        }

        const { concluded, needsChair, hasDissent } = majorityDecision(destroy, keep);

        const [existing] = await db.select({
            id: disposalReviewCouncilItemOutcomes.id,
            chairDecision: disposalReviewCouncilItemOutcomes.chairDecision,
        })
            .from(disposalReviewCouncilItemOutcomes)
            .where(and(
                eq(disposalReviewCouncilItemOutcomes.councilId, councilId),
                eq(disposalReviewCouncilItemOutcomes.itemId, itemId),
            ))
            .limit(1);

        let finalConcluded = concluded;
        let finalNeedsChair = needsChair;
        if (needsChair && existing?.chairDecision) {
            finalConcluded = existing.chairDecision;
            finalNeedsChair = false;
        }

        const payload = {
            destroyVoteCount: destroy,
            keepVoteCount: keep,
            participatingMemberCount: participatingCount,
            concludedDecision: finalConcluded,
            hasDissent,
            needsChairDecision: finalNeedsChair,
            updatedAt: now,
        };

        if (existing) {
            await db.update(disposalReviewCouncilItemOutcomes)
                .set(payload)
                .where(eq(disposalReviewCouncilItemOutcomes.id, existing.id));
        } else {
            await db.insert(disposalReviewCouncilItemOutcomes).values({
                councilId,
                itemId,
                ...payload,
            });
        }
    }
}

export async function councilHasPendingChairDecisions(councilId: string): Promise<boolean> {
    const [row] = await db.select({ id: disposalReviewCouncilItemOutcomes.id })
        .from(disposalReviewCouncilItemOutcomes)
        .where(and(
            eq(disposalReviewCouncilItemOutcomes.councilId, councilId),
            eq(disposalReviewCouncilItemOutcomes.needsChairDecision, true),
        ))
        .limit(1);
    return Boolean(row);
}
