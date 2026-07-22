import { Permission } from "../auth/permission-catalog.ts";
import type { ArchiveAclPrincipalInput } from "./archive-acl-service.ts";

export type AclParentWarningCode =
    | "missing_fond"
    | "missing_dossier_type"
    | "missing_document_type";

export type AclParentWarning = {
    code: AclParentWarningCode;
    message: string;
    principalNames: string[];
};

type PrincipalRef = ArchiveAclPrincipalInput & { name?: string };

type AclGrantIndex = {
    fondPrincipalKeys: Set<string>;
    fondTypePrincipalKeys: Set<string>;
    dossierTypePrincipalKeys: Map<string, Set<string>>;
    documentTypeReadPrincipalKeys: Map<string, Set<string>>;
};

function principalKey(kind: string, id: string): string {
    return `${kind}:${id}`;
}

function namesFromKeys(
    keys: string[],
    nameByKey: Map<string, string>,
): string[] {
    return keys.map((k) => nameByKey.get(k) ?? k);
}

export function buildAclGrantIndex(entries: Array<{
    resourceKind: string;
    resourceId: string;
    permissionKey: string;
    principals: Array<{ kind: string; id: string }>;
}>): AclGrantIndex {
    const fondPrincipalKeys = new Set<string>();
    const fondTypePrincipalKeys = new Set<string>();
    const dossierTypePrincipalKeys = new Map<string, Set<string>>();
    const documentTypeReadPrincipalKeys = new Map<string, Set<string>>();

    for (const entry of entries) {
        for (const p of entry.principals) {
            const key = principalKey(p.kind, p.id);
            if (entry.resourceKind === "fond") {
                fondPrincipalKeys.add(key);
            } else if (entry.resourceKind === "fond_type") {
                fondTypePrincipalKeys.add(key);
            } else if (entry.resourceKind === "dossier_type") {
                const set = dossierTypePrincipalKeys.get(entry.resourceId) ?? new Set();
                set.add(key);
                dossierTypePrincipalKeys.set(entry.resourceId, set);
            } else if (
                entry.resourceKind === "document_type" &&
                (entry.permissionKey === Permission.ARCHIVE_WAREHOUSE_READ ||
                    entry.permissionKey === Permission.ARCHIVE_WAREHOUSE_SEARCH)
            ) {
                const set = documentTypeReadPrincipalKeys.get(entry.resourceId) ?? new Set();
                set.add(key);
                documentTypeReadPrincipalKeys.set(entry.resourceId, set);
            }
        }
    }

    return {
        fondPrincipalKeys,
        fondTypePrincipalKeys,
        dossierTypePrincipalKeys,
        documentTypeReadPrincipalKeys,
    };
}

function hasFondAccess(index: AclGrantIndex, key: string): boolean {
    return index.fondPrincipalKeys.has(key) || index.fondTypePrincipalKeys.has(key);
}

export function warnDossierTypeMissingFond(
    principals: PrincipalRef[],
    index: AclGrantIndex,
    nameByKey: Map<string, string>,
): AclParentWarning | null {
    const missing = principals
        .filter((p) => !hasFondAccess(index, principalKey(p.kind, p.id)))
        .map((p) => principalKey(p.kind, p.id));
    if (missing.length === 0) return null;
    return {
        code: "missing_fond",
        message:
            "Người dùng / vai trò sau chưa được gán phông. Quyền loại hồ sơ chưa có hiệu lực.",
        principalNames: namesFromKeys(missing, nameByKey),
    };
}

export function warnDocumentTypeMissingParent(
    principals: PrincipalRef[],
    index: AclGrantIndex,
    nameByKey: Map<string, string>,
): AclParentWarning | null {
    const missingFond = principals
        .filter((p) => !hasFondAccess(index, principalKey(p.kind, p.id)))
        .map((p) => principalKey(p.kind, p.id));
    if (missingFond.length > 0) {
        return {
            code: "missing_fond",
            message:
                "Người dùng / vai trò sau chưa được gán phông. Quyền loại tài liệu chưa có hiệu lực.",
            principalNames: namesFromKeys(missingFond, nameByKey),
        };
    }
    return null;
}

export function warnMetadataMissingDocumentTypeRead(
    principals: PrincipalRef[],
    documentTypeId: string,
    index: AclGrantIndex,
    nameByKey: Map<string, string>,
): AclParentWarning | null {
    const readKeys = index.documentTypeReadPrincipalKeys.get(documentTypeId) ?? new Set();
    const missing = principals
        .filter((p) => !readKeys.has(principalKey(p.kind, p.id)))
        .map((p) => principalKey(p.kind, p.id));
    if (missing.length === 0) return null;
    return {
        code: "missing_document_type",
        message:
            "Chưa gán quyền xem loại tài liệu ở tab Tài liệu. Phân quyền trường chưa có hiệu lực.",
        principalNames: namesFromKeys(missing, nameByKey),
    };
}
