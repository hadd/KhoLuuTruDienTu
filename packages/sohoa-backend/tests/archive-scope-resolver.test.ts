import { assertEquals } from "@std/assert";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { roles, userProfiles, userRoles } from "../db/schemas/index.ts";
import {
    archiveAclEntries,
    archiveAclPrincipals,
} from "../db/schemas/archive-acl.ts";
import { fonds } from "../db/schemas/fond.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import { Permission } from "../modules/auth/permission-catalog.ts";
import type { UserWithRoles } from "../libs/plugins/auth-profile.ts";
import {
    aclKeyMatchesScope,
    ArchiveScopeResolver,
    mergePrincipalWarehouseGrants,
} from "../modules/archive-permission/archive-scope-resolver.ts";

const TEST_PREFIX = `test-archive-scope/${crypto.randomUUID()}`;

async function ensureTestRole(
    roleId: string,
    name: string,
    permissions: string[],
) {
    const rules = JSON.stringify({ permissions, restrictions: [] });
    const existing = await db.query.roles.findFirst({
        where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
    });

    if (existing) {
        await db.update(roles)
            .set({ name, rules, updatedAt: new Date() })
            .where(eq(roles.id, roleId));
        return existing;
    }

    const [created] = await db.insert(roles).values({
        id: roleId,
        name,
        description: `Test role ${roleId}`,
        rules,
        isBaseRole: false,
    }).returning();
    return created;
}

Deno.test("aclKeyMatchesScope links read and ops warehouse permissions", () => {
    assertEquals(
        aclKeyMatchesScope(
            Permission.ARCHIVE_WAREHOUSE_READ,
            Permission.ARCHIVE_WAREHOUSE_EDIT,
        ),
        true,
    );
    assertEquals(
        aclKeyMatchesScope(
            Permission.ARCHIVE_WAREHOUSE_EDIT,
            Permission.ARCHIVE_WAREHOUSE_READ,
        ),
        true,
    );
    assertEquals(
        aclKeyMatchesScope(
            Permission.ARCHIVE_WAREHOUSE_SEARCH,
            Permission.ARCHIVE_WAREHOUSE_READ,
        ),
        true,
    );
});

Deno.test("mergePrincipalWarehouseGrants keeps fond-only access unrestricted", () => {
    const merged = mergePrincipalWarehouseGrants([
        {
            fondIds: ["fond-f"],
            dossierTypeIds: [],
            documentTypeIds: [],
        },
    ]);

    assertEquals(merged.fondIds, ["fond-f"]);
    assertEquals(merged.dossierTypeIds, []);
    assertEquals(merged.documentTypeIds, []);
});

Deno.test("mergePrincipalWarehouseGrants restricts fond when child assigned on same principal", () => {
    const merged = mergePrincipalWarehouseGrants([
        {
            fondIds: ["fond-f"],
            dossierTypeIds: ["type-t"],
            documentTypeIds: [],
        },
    ]);

    assertEquals(merged.fondIds, ["fond-f"]);
    assertEquals(merged.dossierTypeIds, ["type-t"]);
    assertEquals(merged.documentTypeIds, []);
});

Deno.test("mergePrincipalWarehouseGrants ignores child ACL bleed from other principals", () => {
    const merged = mergePrincipalWarehouseGrants([
        {
            fondIds: ["fond-f"],
            dossierTypeIds: [],
            documentTypeIds: [],
        },
        {
            fondIds: [],
            dossierTypeIds: ["type-t"],
            documentTypeIds: [],
        },
    ]);

    assertEquals(merged.fondIds, ["fond-f"]);
    assertEquals(merged.dossierTypeIds, []);
    assertEquals(merged.documentTypeIds, []);
});

Deno.test("mergePrincipalWarehouseGrants supports child-only browse scope", () => {
    const merged = mergePrincipalWarehouseGrants([
        {
            fondIds: [],
            dossierTypeIds: ["type-t"],
            documentTypeIds: ["doc-d"],
        },
    ]);

    assertEquals(merged.fondIds, []);
    assertEquals(merged.dossierTypeIds, ["type-t"]);
    assertEquals(merged.documentTypeIds, ["doc-d"]);
});

async function createWarehouseReaderProfile(emailKey: string, roleId: string) {
    await ensureTestRole(roleId, roleId, [Permission.ARCHIVE_WAREHOUSE_READ]);

    const passwordHash = await hashPassword("Test@sohoa2026");
    const [profile] = await db
        .insert(userProfiles)
        .values({
            email: `${TEST_PREFIX}-${emailKey}@test.local`,
            fullName: `Test ${emailKey}`,
            passwordHash,
        })
        .returning();

    await db.insert(userRoles).values({ userId: profile.id, roleId });

    const fullProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, profile.id),
        with: {
            userRoles: {
                with: { role: true },
            },
        },
    });

    return fullProfile as UserWithRoles;
}

async function grantAcl(input: {
    principalKind: "user" | "role";
    principalId: string;
    resourceKind: "fond" | "fond_type" | "dossier_type" | "document_type";
    resourceId: string;
    permissionKey?: string;
}) {
    const permissionKey = input.permissionKey ?? Permission.ARCHIVE_WAREHOUSE_READ;
    const [entry] = await db
        .insert(archiveAclEntries)
        .values({
            resourceKind: input.resourceKind,
            resourceId: input.resourceId,
            permissionKey,
        })
        .onConflictDoUpdate({
            target: [
                archiveAclEntries.resourceKind,
                archiveAclEntries.resourceId,
                archiveAclEntries.permissionKey,
            ],
            set: { updatedAt: new Date() },
        })
        .returning();

    await db
        .insert(archiveAclPrincipals)
        .values({
            entryId: entry.id,
            principalKind: input.principalKind,
            principalId: input.principalId,
        })
        .onConflictDoNothing();
}

async function deleteAclForResource(resourceId: string) {
    const entries = await db
        .select({ id: archiveAclEntries.id })
        .from(archiveAclEntries)
        .where(eq(archiveAclEntries.resourceId, resourceId));

    for (const entry of entries) {
        await db.delete(archiveAclPrincipals).where(
            eq(archiveAclPrincipals.entryId, entry.id),
        );
    }

    await db.delete(archiveAclEntries).where(eq(archiveAclEntries.resourceId, resourceId));
}

Deno.test({
    name: "ArchiveScopeResolver fond-only user is not filtered by role child ACL",
    sanitizeResources: false,
    sanitizeOps: false,
}, async () => {
    const fondId = `${TEST_PREFIX}-fond`;
    const dossierTypeId = `${TEST_PREFIX}-dossier-type`;
    const readerRoleId = `${TEST_PREFIX}-reader`;
    const bleedRoleId = `${TEST_PREFIX}-bleed`;

    await ensureTestRole(readerRoleId, "Warehouse Reader", [
        Permission.ARCHIVE_WAREHOUSE_READ,
    ]);
    await ensureTestRole(bleedRoleId, "Warehouse Bleed", [
        Permission.ARCHIVE_WAREHOUSE_READ,
    ]);

    await db.insert(fonds).values({
        id: fondId,
        fondName: "Scope test fond",
        archiveAgency: "Test",
        adminstrativeHistory: "Test",
        fondType: "Test",
    }).onConflictDoNothing();

    const profile = await createWarehouseReaderProfile("scope-user", readerRoleId);
    await db.insert(userRoles).values({ userId: profile.id, roleId: bleedRoleId });
    const profileWithBleedRole = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, profile.id),
        with: {
            userRoles: {
                with: { role: true },
            },
        },
    }) as UserWithRoles;
    const bleedRoleOnlyProfile = await createWarehouseReaderProfile(
        "bleed-role-only",
        bleedRoleId,
    );

    try {
        await grantAcl({
            principalKind: "user",
            principalId: profile.id,
            resourceKind: "fond",
            resourceId: fondId,
        });
        await grantAcl({
            principalKind: "role",
            principalId: bleedRoleId,
            resourceKind: "dossier_type",
            resourceId: dossierTypeId,
        });

        const scope = await ArchiveScopeResolver.resolve(profileWithBleedRole, {
            includeAllCapableResources: true,
        });

        assertEquals(scope.mode, "scoped");
        if (scope.mode !== "scoped") return;

        assertEquals(scope.fondIds.includes(fondId), true);
        assertEquals(scope.dossierTypeIds.length, 0);
        assertEquals(scope.documentTypeIds.length, 0);

        const bleedScope = await ArchiveScopeResolver.resolve(bleedRoleOnlyProfile, {
            includeAllCapableResources: true,
        });
        assertEquals(bleedScope.mode, "scoped");
        if (bleedScope.mode !== "scoped") return;
        assertEquals(bleedScope.fondIds.length, 0);
        assertEquals(bleedScope.dossierTypeIds, [dossierTypeId]);
    } finally {
        await deleteAclForResource(fondId);
        await deleteAclForResource(dossierTypeId);
        await db.delete(fonds).where(eq(fonds.id, fondId));
        await db.delete(userRoles).where(eq(userRoles.userId, profile.id));
        await db.delete(userProfiles).where(eq(userProfiles.id, profile.id));
        await db.delete(userRoles).where(eq(userRoles.userId, bleedRoleOnlyProfile.id));
        await db.delete(userProfiles).where(eq(userProfiles.id, bleedRoleOnlyProfile.id));
    }
});

Deno.test({
    name: "ArchiveScopeResolver fond plus child on same user restricts inside fond",
    sanitizeResources: false,
    sanitizeOps: false,
}, async () => {
    const fondId = `${TEST_PREFIX}-fond-restricted`;
    const dossierTypeId = `${TEST_PREFIX}-restricted-type`;
    const readerRoleId = `${TEST_PREFIX}-reader-restricted`;

    await ensureTestRole(readerRoleId, "Warehouse Reader Restricted", [
        Permission.ARCHIVE_WAREHOUSE_READ,
    ]);

    await db.insert(fonds).values({
        id: fondId,
        fondName: "Restricted fond",
        archiveAgency: "Test",
        adminstrativeHistory: "Test",
        fondType: "Test",
    }).onConflictDoNothing();

    const profile = await createWarehouseReaderProfile("restricted-user", readerRoleId);

    try {
        await grantAcl({
            principalKind: "user",
            principalId: profile.id,
            resourceKind: "fond",
            resourceId: fondId,
        });
        await grantAcl({
            principalKind: "user",
            principalId: profile.id,
            resourceKind: "dossier_type",
            resourceId: dossierTypeId,
        });

        const scope = await ArchiveScopeResolver.resolve(profile, {
            includeAllCapableResources: true,
        });

        assertEquals(scope.mode, "scoped");
        if (scope.mode !== "scoped") return;

        assertEquals(scope.fondIds, [fondId]);
        assertEquals(scope.dossierTypeIds, [dossierTypeId]);
        assertEquals(scope.documentTypeIds, []);
    } finally {
        await deleteAclForResource(fondId);
        await deleteAclForResource(dossierTypeId);
        await db.delete(fonds).where(eq(fonds.id, fondId));
        await db.delete(userRoles).where(eq(userRoles.userId, profile.id));
        await db.delete(userProfiles).where(eq(userProfiles.id, profile.id));
    }
});
