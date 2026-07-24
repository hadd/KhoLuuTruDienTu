import {
    assertClearance,
    assertPermissionAllowed,
} from "./security-clearance.ts";
import { assertPasswordGates } from "./security-access-token.ts";

export type SecurityAccessHeaders = {
    levelToken?: string;
    dossierToken?: string;
};

export function securityAccessHeadersFromRequest(request: Request): SecurityAccessHeaders {
    return {
        levelToken: request.headers.get("x-security-level-token") ?? undefined,
        dossierToken: request.headers.get("x-dossier-access-token") ?? undefined,
    };
}

export async function assertSecurityResourceAccess(input: {
    userId: string;
    userSecurityLevelId: string | null | undefined;
    resourceSecurityLevelId: string | null | undefined;
    permissionDefKey: "view" | "download_original" | "download_watermark" | "export";
    dossierId?: string | null;
    levelToken?: string;
    dossierToken?: string;
}): Promise<void> {
    await assertClearance(input.userSecurityLevelId, input.resourceSecurityLevelId);
    await assertPermissionAllowed(input.resourceSecurityLevelId, input.permissionDefKey);
    await assertPasswordGates({
        userId: input.userId,
        resourceSecurityLevelId: input.resourceSecurityLevelId,
        dossierId: input.dossierId ?? undefined,
        levelToken: input.levelToken,
        dossierToken: input.dossierToken,
    });
}
