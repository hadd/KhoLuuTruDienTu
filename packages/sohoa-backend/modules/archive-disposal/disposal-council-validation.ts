import {
    DisposalCouncilMemberRepresentationType,
    type DisposalCouncilMemberPositionRoleType,
    type DisposalCouncilMemberRepresentationTypeType,
    MANDATORY_DISPOSAL_COUNCIL_REPRESENTATION_TYPES,
    MIN_DISPOSAL_COUNCIL_MEMBERS,
} from "../../db/schemas/archive-disposal-constants.ts";

export type CouncilMemberInput = {
    userId: string;
    positionRole: DisposalCouncilMemberPositionRoleType;
    representationType: DisposalCouncilMemberRepresentationTypeType;
    sortOrder?: number;
};

export type CouncilMemberSnapshot = {
    userId: string;
    positionRole: DisposalCouncilMemberPositionRoleType;
    representationType: DisposalCouncilMemberRepresentationTypeType;
    sortOrder: number;
};

export type CouncilValidationError = {
    code: string;
    message: string;
    field?: string;
};

const REPRESENTATION_LABELS: Record<DisposalCouncilMemberRepresentationTypeType, string> = {
    [DisposalCouncilMemberRepresentationType.LEADERSHIP]: "Đại diện lãnh đạo",
    [DisposalCouncilMemberRepresentationType.ARCHIVE_DEPT]: "Đại diện Phòng Lưu trữ",
    [DisposalCouncilMemberRepresentationType.SPECIALIST_DEPT]: "Đại diện phòng chuyên môn",
    [DisposalCouncilMemberRepresentationType.OTHER]: "Khác",
};

export function validateCouncilMemberCount(
    members: CouncilMemberInput[],
): CouncilValidationError | null {
    if (members.length < MIN_DISPOSAL_COUNCIL_MEMBERS) {
        return {
            code: "INSUFFICIENT_MEMBERS",
            message: `Hội đồng phải có tối thiểu ${MIN_DISPOSAL_COUNCIL_MEMBERS} thành viên (hiện có ${members.length})`,
            field: "members",
        };
    }
    return null;
}

export function validateMandatoryRepresentationTypes(
    members: CouncilMemberInput[],
): CouncilValidationError | null {
    const present = new Set(members.map((member) => member.representationType));
    for (const required of MANDATORY_DISPOSAL_COUNCIL_REPRESENTATION_TYPES) {
        if (!present.has(required)) {
            return {
                code: "MISSING_REPRESENTATION_TYPE",
                message: `Thiếu vai trò bắt buộc: ${REPRESENTATION_LABELS[required]}`,
                field: "members",
            };
        }
    }
    return null;
}

export function validateUniqueMemberUserIds(
    members: CouncilMemberInput[],
): CouncilValidationError | null {
    const seen = new Set<string>();
    for (const member of members) {
        if (seen.has(member.userId)) {
            return {
                code: "DUPLICATE_MEMBER",
                message: "Một người dùng không được thêm hai lần vào Hội đồng",
                field: "members",
            };
        }
        seen.add(member.userId);
    }
    return null;
}

export function validateCouncilMembers(
    members: CouncilMemberInput[],
): CouncilValidationError | null {
    return validateCouncilMemberCount(members)
        ?? validateUniqueMemberUserIds(members)
        ?? validateMandatoryRepresentationTypes(members);
}

export function validateMemberUpdateAfterReviewStarted(input: {
    previousMembers: CouncilMemberSnapshot[];
    nextMembers: CouncilMemberInput[];
    reason?: string;
}): CouncilValidationError | null {
    if (input.nextMembers.length === 0) {
        return {
            code: "CANNOT_REMOVE_ALL_MEMBERS",
            message: "Không được xóa toàn bộ thành viên sau khi Hội đồng đã bắt đầu thẩm tra",
            field: "members",
        };
    }

    const previousIds = new Set(input.previousMembers.map((member) => member.userId));
    const nextIds = new Set(input.nextMembers.map((member) => member.userId));
    const hasChanges = input.previousMembers.length !== input.nextMembers.length ||
        input.previousMembers.some((member) => !nextIds.has(member.userId)) ||
        input.nextMembers.some((member) => !previousIds.has(member.userId)) ||
        input.previousMembers.some((previous) => {
            const next = input.nextMembers.find((member) => member.userId === previous.userId);
            if (!next) return true;
            return next.positionRole !== previous.positionRole ||
                next.representationType !== previous.representationType;
        });

    if (hasChanges && !input.reason?.trim()) {
        return {
            code: "REASON_REQUIRED",
            message: "Vui lòng nhập lý do thay đổi thành viên Hội đồng",
            field: "reason",
        };
    }

    return validateCouncilMembers(input.nextMembers);
}

export function toMemberSnapshots(members: CouncilMemberInput[]): CouncilMemberSnapshot[] {
    return members.map((member, index) => ({
        userId: member.userId,
        positionRole: member.positionRole,
        representationType: member.representationType,
        sortOrder: member.sortOrder ?? index,
    }));
}

export function detectMemberHistoryAction(
    previousMembers: CouncilMemberSnapshot[],
    nextMembers: CouncilMemberSnapshot[],
): "ADD" | "REMOVE" | "UPDATE" {
    const previousIds = new Set(previousMembers.map((member) => member.userId));
    const nextIds = new Set(nextMembers.map((member) => member.userId));
    if (nextMembers.some((member) => !previousIds.has(member.userId))) {
        return "ADD";
    }
    if (previousMembers.some((member) => !nextIds.has(member.userId))) {
        return "REMOVE";
    }
    return "UPDATE";
}
