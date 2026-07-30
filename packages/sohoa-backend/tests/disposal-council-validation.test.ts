import {
    assertEquals,
    assertNotEquals,
} from "jsr:@std/assert";

import {
    DisposalCouncilMemberRepresentationType,
} from "../db/schemas/archive-disposal-constants.ts";
import {
    type CouncilMemberInput,
    validateCouncilMembers,
    validateMemberUpdateAfterReviewStarted,
    validateMandatoryRepresentationTypes,
} from "../modules/archive-disposal/disposal-council-validation.ts";

function buildValidMembers(): CouncilMemberInput[] {
    return [
        {
            userId: "u1",
            positionRole: "CHAIR",
            representationType: DisposalCouncilMemberRepresentationType.LEADERSHIP,
        },
        {
            userId: "u2",
            positionRole: "SECRETARY",
            representationType: DisposalCouncilMemberRepresentationType.ARCHIVE_DEPT,
        },
        {
            userId: "u3",
            positionRole: "MEMBER",
            representationType: DisposalCouncilMemberRepresentationType.SPECIALIST_DEPT,
        },
        {
            userId: "u4",
            positionRole: "MEMBER",
            representationType: DisposalCouncilMemberRepresentationType.OTHER,
        },
        {
            userId: "u5",
            positionRole: "MEMBER",
            representationType: DisposalCouncilMemberRepresentationType.OTHER,
        },
    ];
}

Deno.test("validateCouncilMembers accepts 5 members with mandatory roles", () => {
    assertEquals(validateCouncilMembers(buildValidMembers()), null);
});

Deno.test("validateCouncilMembers rejects fewer than 5 members", () => {
    const members = buildValidMembers().slice(0, 4);
    const error = validateCouncilMembers(members);
    assertNotEquals(error, null);
    assertEquals(error?.code, "INSUFFICIENT_MEMBERS");
});

Deno.test("validateMandatoryRepresentationTypes reports missing archive dept", () => {
    const members = buildValidMembers().map((member) =>
        member.representationType === DisposalCouncilMemberRepresentationType.ARCHIVE_DEPT
            ? {
                ...member,
                representationType: DisposalCouncilMemberRepresentationType.OTHER,
            }
            : member
    );
    const error = validateMandatoryRepresentationTypes(members);
    assertNotEquals(error, null);
    assertEquals(error?.code, "MISSING_REPRESENTATION_TYPE");
});

Deno.test("validateMemberUpdateAfterReviewStarted requires reason on changes", () => {
    const previous = buildValidMembers().map((member, index) => ({
        ...member,
        sortOrder: index,
    }));
    const next = [...previous, {
        userId: "u6",
        positionRole: "MEMBER" as const,
        representationType: DisposalCouncilMemberRepresentationType.OTHER,
        sortOrder: 5,
    }];

    const withoutReason = validateMemberUpdateAfterReviewStarted({
        previousMembers: previous,
        nextMembers: next,
    });
    assertEquals(withoutReason?.code, "REASON_REQUIRED");

    const withReason = validateMemberUpdateAfterReviewStarted({
        previousMembers: previous,
        nextMembers: next,
        reason: "Bổ sung thành viên",
    });
    assertEquals(withReason, null);
});

Deno.test("validateMemberUpdateAfterReviewStarted blocks removing all members", () => {
    const previous = buildValidMembers().map((member, index) => ({
        ...member,
        sortOrder: index,
    }));
    const error = validateMemberUpdateAfterReviewStarted({
        previousMembers: previous,
        nextMembers: [],
        reason: "test",
    });
    assertEquals(error?.code, "CANNOT_REMOVE_ALL_MEMBERS");
});
