import { httpError } from "@shared/common-lib";
import { QC_CHECKER_WORKFLOW } from "../../db/schemas/workflow-constants.ts";
import type { GroupMemberRole } from "../../db/schemas/types.ts";

export type QcLevelInput = {
    userIds: string[];
};

export type QcWorkflowConfig = {
    roundNumber: number;
    qcPeersByStep: Map<number, string[]>;
};

export type NormalizedGroupQcInput = {
    roundNumber: number;
    qcLevels: QcLevelInput[];
};

const QC_GROUP_ROLES_LIST = ["qc1", "qc2", "qc3", "qc4", "qc5"] as const satisfies readonly GroupMemberRole[];

export function flattenQcUserIds(qcLevels: QcLevelInput[]): string[] {
    return qcLevels.flatMap((level) => level.userIds);
}

export function normalizeGroupQcInput(input: {
    roundNumber?: number;
    qcIds?: string[];
    qcLevels?: QcLevelInput[];
}): NormalizedGroupQcInput {
    if (input.qcLevels && input.qcLevels.length > 0) {
        const roundNumber = input.roundNumber ?? input.qcLevels.length;
        if (input.qcLevels.length !== roundNumber) {
            throw httpError.badRequest(
                `qcLevels length (${input.qcLevels.length}) must equal roundNumber (${roundNumber})`,
            );
        }
        for (let i = 0; i < input.qcLevels.length; i++) {
            const level = input.qcLevels[i]!;
            if (level.userIds.length === 0) {
                throw httpError.badRequest(`QC level ${i + 1} must have at least one member`);
            }
            const unique = new Set(level.userIds);
            if (unique.size !== level.userIds.length) {
                throw httpError.badRequest(`Duplicate QC IDs in level ${i + 1}`);
            }
        }
        return { roundNumber, qcLevels: input.qcLevels };
    }

    if (input.qcIds && input.qcIds.length > 0) {
        const roundNumber = input.roundNumber ?? input.qcIds.length;
        if (input.qcIds.length !== roundNumber) {
            throw httpError.badRequest(
                `qcIds length (${input.qcIds.length}) must equal roundNumber (${roundNumber})`,
            );
        }
        return {
            roundNumber,
            qcLevels: input.qcIds.map((id) => ({ userIds: [id] })),
        };
    }

    throw httpError.badRequest("qcLevels or qcIds is required");
}

export function qcLevelsToPeersByStep(qcLevels: QcLevelInput[]): Map<number, string[]> {
    const map = new Map<number, string[]>();
    for (let i = 0; i < qcLevels.length; i++) {
        map.set(i + 1, [...qcLevels[i]!.userIds]);
    }
    return map;
}

export function buildQcWorkflowConfig(
    roundNumber: number,
    qcLevels: QcLevelInput[],
): QcWorkflowConfig {
    return {
        roundNumber,
        qcPeersByStep: qcLevelsToPeersByStep(qcLevels.slice(0, roundNumber)),
    };
}

export function peersByStepFromMembers(
    members: Array<{ userId: string; role: GroupMemberRole }>,
    roundNumber: number,
): Map<number, string[]> {
    const map = new Map<number, string[]>();
    for (let i = 0; i < roundNumber; i++) {
        const role = QC_GROUP_ROLES_LIST[i];
        const peers = members
            .filter((member) => member.role === role)
            .map((member) => member.userId);
        if (peers.length > 0) {
            map.set(i + 1, peers);
        }
    }
    return map;
}

export function qcConfigChanged(previous: QcWorkflowConfig, next: QcWorkflowConfig): boolean {
    if (previous.roundNumber !== next.roundNumber) {
        return true;
    }

    for (let step = 1; step <= next.roundNumber; step++) {
        const prevPeers = [...(previous.qcPeersByStep.get(step) ?? [])].sort().join(",");
        const nextPeers = [...(next.qcPeersByStep.get(step) ?? [])].sort().join(",");
        if (prevPeers !== nextPeers) {
            return true;
        }
    }

    return false;
}

export function assertEachQcLevelHasPeers(
    qcPeersByStep: Map<number, string[]>,
    roundNumber: number,
) {
    for (let step = 1; step <= roundNumber; step++) {
        const peers = qcPeersByStep.get(step);
        if (!peers || peers.length === 0) {
            throw httpError.badRequest(
                `Group must have at least one QC member for level ${step}`,
            );
        }
    }
}

export function checkerRoleForStep(step: number) {
    const config = QC_CHECKER_WORKFLOW[step - 1];
    if (!config) {
        throw httpError.badRequest(`Invalid QC step ${step}`);
    }
    return config;
}
