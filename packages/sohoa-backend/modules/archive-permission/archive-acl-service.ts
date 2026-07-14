import { httpError } from "@shared/common-lib";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import {
    ARCHIVE_ACL_PRINCIPAL_KINDS,
    ARCHIVE_ACL_RESOURCE_KINDS,
    archiveAclEntries,
    archiveAclPrincipals,
    type ArchiveAclPrincipalKind,
    type ArchiveAclResourceKind,
} from "../../db/schemas/archive-acl.ts";
import { dossierTypes } from "../../db/schemas/dossier-type.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { metadataTemplates } from "../../db/schemas/metadata_template.ts";
import { roles } from "../../db/schemas/role.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { Permission } from "../auth/permission-catalog.ts";

export const ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS = [
    Permission.ARCHIVE_WAREHOUSE_SEARCH,
    Permission.ARCHIVE_WAREHOUSE_READ,
    Permission.ARCHIVE_WAREHOUSE_MANAGE,
] as const;

export type ArchiveAclPrincipalInput = {
    kind: ArchiveAclPrincipalKind;
    id: string;
};

function assertResourceKind(kind: string): ArchiveAclResourceKind {
    if (!(ARCHIVE_ACL_RESOURCE_KINDS as readonly string[]).includes(kind)) {
        throw httpError.badRequest(`resourceKind không hợp lệ: ${kind}`);
    }
    return kind as ArchiveAclResourceKind;
}

function assertPermissionKey(key: string): string {
    if (!(ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS as readonly string[]).includes(key)) {
        throw httpError.badRequest(`permissionKey không hợp lệ: ${key}`);
    }
    return key;
}

async function assertResourceExists(
    resourceKind: ArchiveAclResourceKind,
    resourceId: string,
): Promise<void> {
    if (resourceKind === "fond") {
        const row = await db.query.fonds.findFirst({
            where: and(eq(fonds.id, resourceId), isNull(fonds.deletedAt)),
            columns: { id: true },
        });
        if (!row) throw httpError.notFound("Không tìm thấy phông");
        return;
    }
    if (resourceKind === "fond_type") {
        const row = await db.query.fonds.findFirst({
            where: and(eq(fonds.fondType, resourceId), isNull(fonds.deletedAt)),
            columns: { id: true },
        });
        if (!row) {
            throw httpError.notFound(`Không tìm thấy phông nào với loại "${resourceId}"`);
        }
        return;
    }
    if (resourceKind === "dossier_type") {
        const row = await db.query.dossierTypes.findFirst({
            where: eq(dossierTypes.id, resourceId),
            columns: { id: true },
        });
        if (!row) throw httpError.notFound("Không tìm thấy loại hồ sơ");
        return;
    }
    const row = await db.query.metadataTemplates.findFirst({
        where: and(
            eq(metadataTemplates.id, resourceId),
            isNull(metadataTemplates.deletedAt),
        ),
        columns: { id: true },
    });
    if (!row) throw httpError.notFound("Không tìm thấy loại tài liệu");
}

async function assertPrincipalsExist(
    principals: ArchiveAclPrincipalInput[],
): Promise<void> {
    for (const principal of principals) {
        if (!(ARCHIVE_ACL_PRINCIPAL_KINDS as readonly string[]).includes(principal.kind)) {
            throw httpError.badRequest(`principal.kind không hợp lệ: ${principal.kind}`);
        }
        if (!principal.id?.trim()) {
            throw httpError.badRequest("principal.id là bắt buộc");
        }
        if (principal.kind === "user") {
            const row = await db.query.userProfiles.findFirst({
                where: and(
                    eq(userProfiles.id, principal.id),
                    isNull(userProfiles.deletedAt),
                ),
                columns: { id: true },
            });
            if (!row) throw httpError.notFound(`Không tìm thấy user: ${principal.id}`);
        } else {
            const row = await db.query.roles.findFirst({
                where: and(eq(roles.id, principal.id), isNull(roles.deletedAt)),
                columns: { id: true },
            });
            if (!row) throw httpError.notFound(`Không tìm thấy role: ${principal.id}`);
        }
    }
}

async function ensureEntry(
    resourceKind: ArchiveAclResourceKind,
    resourceId: string,
    permissionKey: string,
) {
    const existing = await db.query.archiveAclEntries.findFirst({
        where: and(
            eq(archiveAclEntries.resourceKind, resourceKind),
            eq(archiveAclEntries.resourceId, resourceId),
            eq(archiveAclEntries.permissionKey, permissionKey),
        ),
    });
    if (existing) return existing;

    const [created] = await db.insert(archiveAclEntries).values({
        resourceKind,
        resourceId,
        permissionKey,
        updatedAt: new Date(),
    }).returning();
    return created;
}

export const ArchiveAclService = {
    async getMatrix() {
        const [fondRows, dossierTypeRows, documentTypeRows, entries] = await Promise.all([
            db.query.fonds.findMany({
                where: isNull(fonds.deletedAt),
                columns: { id: true, fondName: true, fondType: true },
                orderBy: (t, { asc }) => [asc(t.fondName)],
            }),
            db.query.dossierTypes.findMany({
                columns: { id: true, name: true },
                orderBy: (t, { asc }) => [asc(t.name)],
            }),
            db.query.metadataTemplates.findMany({
                where: and(
                    isNull(metadataTemplates.deletedAt),
                    eq(metadataTemplates.isActive, true),
                ),
                columns: { id: true, name: true },
                orderBy: (t, { asc }) => [asc(t.name)],
            }),
            db.query.archiveAclEntries.findMany({
                with: { principals: true },
            }),
        ]);

        const byResource = new Map<string, typeof entries>();
        for (const entry of entries) {
            const key = `${entry.resourceKind}:${entry.resourceId}`;
            const list = byResource.get(key) ?? [];
            list.push(entry);
            byResource.set(key, list);
        }

        function mapResource(
            kind: ArchiveAclResourceKind,
            id: string,
            name: string,
        ) {
            const resourceEntries = byResource.get(`${kind}:${id}`) ?? [];
            const permissions = ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS.map((permissionKey) => {
                const entry = resourceEntries.find((e) => e.permissionKey === permissionKey);
                return {
                    permissionKey,
                    entryId: entry?.id ?? null,
                    principals: (entry?.principals ?? []).map((p) => ({
                        kind: p.principalKind,
                        id: p.principalId,
                    })),
                };
            });
            return { resourceKind: kind, resourceId: id, name, permissions };
        }

        const fondTypeCounts = new Map<string, number>();
        for (const fond of fondRows) {
            const type = fond.fondType.trim();
            if (!type) continue;
            fondTypeCounts.set(type, (fondTypeCounts.get(type) ?? 0) + 1);
        }
        const fondTypeValues = [...fondTypeCounts.keys()].sort((a, b) =>
            a.localeCompare(b, "vi")
        );

        return {
            permissionKeys: [...ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS],
            fondTypes: fondTypeValues.map((type) =>
                mapResource(
                    "fond_type",
                    type,
                    `${type} (${fondTypeCounts.get(type)} phông)`,
                )
            ),
            fonds: fondRows.map((f) => mapResource("fond", f.id, f.fondName)),
            dossierTypes: dossierTypeRows.map((d) =>
                mapResource("dossier_type", d.id, d.name)
            ),
            documentTypes: documentTypeRows.map((d) =>
                mapResource("document_type", d.id, d.name)
            ),
        };
    },

    async setPrincipals(input: {
        resourceKind: string;
        resourceId: string;
        permissionKey: string;
        principals: ArchiveAclPrincipalInput[];
    }) {
        const resourceKind = assertResourceKind(input.resourceKind);
        const permissionKey = assertPermissionKey(input.permissionKey);
        const resourceId = input.resourceId.trim();
        if (!resourceId) throw httpError.badRequest("resourceId là bắt buộc");

        await assertResourceExists(resourceKind, resourceId);
        await assertPrincipalsExist(input.principals);

        const entry = await ensureEntry(resourceKind, resourceId, permissionKey);

        await db.delete(archiveAclPrincipals).where(
            eq(archiveAclPrincipals.entryId, entry.id),
        );

        if (input.principals.length > 0) {
            await db.insert(archiveAclPrincipals).values(
                input.principals.map((p) => ({
                    entryId: entry.id,
                    principalKind: p.kind,
                    principalId: p.id,
                    updatedAt: new Date(),
                })),
            );
        }

        return this.getMatrix();
    },

    /** Apply all warehouse permission keys to the given principals on one resource. */
    async applyAllPermissions(input: {
        resourceKind: string;
        resourceId: string;
        principals: ArchiveAclPrincipalInput[];
    }) {
        const resourceKind = assertResourceKind(input.resourceKind);
        const resourceId = input.resourceId.trim();
        if (!resourceId) throw httpError.badRequest("resourceId là bắt buộc");
        if (input.principals.length === 0) {
            throw httpError.badRequest("Cần chọn ít nhất một user hoặc role");
        }

        await assertResourceExists(resourceKind, resourceId);
        await assertPrincipalsExist(input.principals);

        for (const permissionKey of ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS) {
            const entry = await ensureEntry(resourceKind, resourceId, permissionKey);
            const existing = await db.query.archiveAclPrincipals.findMany({
                where: eq(archiveAclPrincipals.entryId, entry.id),
            });
            const existingKeys = new Set(
                existing.map((p) => `${p.principalKind}:${p.principalId}`),
            );
            const toInsert = input.principals.filter(
                (p) => !existingKeys.has(`${p.kind}:${p.id}`),
            );
            if (toInsert.length > 0) {
                await db.insert(archiveAclPrincipals).values(
                    toInsert.map((p) => ({
                        entryId: entry.id,
                        principalKind: p.kind,
                        principalId: p.id,
                        updatedAt: new Date(),
                    })),
                );
            }
        }

        return this.getMatrix();
    },

    async listPrincipalCatalog() {
        const [users, roleRows] = await Promise.all([
            db.query.userProfiles.findMany({
                where: isNull(userProfiles.deletedAt),
                columns: { id: true, fullName: true, email: true },
                orderBy: (t, { asc }) => [asc(t.fullName)],
                limit: 500,
            }),
            db.query.roles.findMany({
                where: isNull(roles.deletedAt),
                columns: { id: true, name: true },
                orderBy: (t, { asc }) => [asc(t.name)],
            }),
        ]);
        return {
            users: users.map((u) => ({
                id: u.id,
                name: u.fullName || u.email || u.id,
                email: u.email,
            })),
            roles: roleRows.map((r) => ({ id: r.id, name: r.name })),
        };
    },
};
