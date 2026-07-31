import { assertEquals, assertRejects } from "@std/assert";
import { and, eq, isNull } from "drizzle-orm";
import { AppError } from "@shared/common-lib";
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
import { ArchiveWarehouseService, resolveWarehouseFondActions } from "../modules/archive/archive-warehouse-service.ts";
import { aclKeyMatchesScope } from "../modules/archive-permission/archive-scope-resolver.ts";
import {
    createArchiveWarehouseMoveFixture,
    deleteArchiveWarehouseMoveFixture,
} from "./archive-warehouse-test-helper.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";

const TEST_PREFIX = `test-wh-sec/${crypto.randomUUID()}`;

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

async function createUserWithRole(roleId: string, emailKey: string) {
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
                where: isNull(userRoles.expiredAt),
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
    permissionKey: string;
}) {
    const [entry] = await db
        .insert(archiveAclEntries)
        .values({
            resourceKind: input.resourceKind,
            resourceId: input.resourceId,
            permissionKey: input.permissionKey,
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

Deno.test("aclKeyMatchesScope links configure_security with read and edit", () => {
    assertEquals(
        aclKeyMatchesScope(
            Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
            Permission.ARCHIVE_WAREHOUSE_READ,
        ),
        true,
    );
    assertEquals(
        aclKeyMatchesScope(
            Permission.ARCHIVE_WAREHOUSE_EDIT,
            Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
        ),
        false,
    );
});

Deno.test({
    name: "resolveWarehouseFondActions separates edit and configure_security",
    sanitizeResources: false,
    sanitizeOps: false,
}, async () => {
    const fondId = `${TEST_PREFIX}-actions-fond`;
    const editRoleId = `${TEST_PREFIX}-edit-only`;
    const securityRoleId = `${TEST_PREFIX}-security-only`;

    await ensureTestRole(editRoleId, "Edit only", [Permission.ARCHIVE_WAREHOUSE_EDIT]);
    await ensureTestRole(securityRoleId, "Security only", [
        Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
    ]);

    await db.insert(fonds).values({
        id: fondId,
        fondName: "Actions test fond",
        archiveAgency: "Test",
        adminstrativeHistory: "Test",
        fondType: "Test",
    }).onConflictDoNothing();

    const editUser = await createUserWithRole(editRoleId, "edit-user");
    const securityUser = await createUserWithRole(securityRoleId, "security-user");

    try {
        await grantAcl({
            principalKind: "user",
            principalId: editUser.id,
            resourceKind: "fond",
            resourceId: fondId,
            permissionKey: Permission.ARCHIVE_WAREHOUSE_EDIT,
        });
        await grantAcl({
            principalKind: "user",
            principalId: securityUser.id,
            resourceKind: "fond",
            resourceId: fondId,
            permissionKey: Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
        });

        const editActions = await resolveWarehouseFondActions(editUser, fondId);
        assertEquals(editActions.edit, true);
        assertEquals(editActions.configureSecurity, false);

        const securityActions = await resolveWarehouseFondActions(securityUser, fondId);
        assertEquals(securityActions.edit, false);
        assertEquals(securityActions.configureSecurity, true);
    } finally {
        await deleteAclForResource(fondId);
        await db.delete(userRoles).where(eq(userRoles.userId, editUser.id));
        await db.delete(userProfiles).where(eq(userProfiles.id, editUser.id));
        await db.delete(userRoles).where(eq(userRoles.userId, securityUser.id));
        await db.delete(userProfiles).where(eq(userProfiles.id, securityUser.id));
        await db.delete(fonds).where(eq(fonds.id, fondId));
    }
});

Deno.test({
    name: "Archive Warehouse security APIs require configure_security",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    const project = await createTestProject();
    const editRoleId = `${TEST_PREFIX}-api-edit`;
    const securityRoleId = `${TEST_PREFIX}-api-security`;

    await ensureTestRole(editRoleId, "API edit only", [Permission.ARCHIVE_WAREHOUSE_EDIT]);
    await ensureTestRole(securityRoleId, "API security only", [
        Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
    ]);

    const editUser = await createUserWithRole(editRoleId, "api-edit");
    const securityUser = await createUserWithRole(securityRoleId, "api-security");
    const fixture = await createArchiveWarehouseMoveFixture(TEST_PREFIX, project.projectCode);

    try {
        await grantAcl({
            principalKind: "user",
            principalId: editUser.id,
            resourceKind: "fond",
            resourceId: fixture.fondId,
            permissionKey: Permission.ARCHIVE_WAREHOUSE_EDIT,
        });
        await grantAcl({
            principalKind: "user",
            principalId: securityUser.id,
            resourceKind: "fond",
            resourceId: fixture.fondId,
            permissionKey: Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
        });

        await t.step("forbidden dossier security without configure_security", async () => {
            const error = await assertRejects(
                () => ArchiveWarehouseService.updateDossierSecurity(editUser, {
                    dossierId: fixture.sourceDossierId,
                }),
                AppError,
            ) as AppError;

            assertEquals(error.status, 403);
        });

        await t.step("forbidden file security without configure_security", async () => {
            const error = await assertRejects(
                () => ArchiveWarehouseService.updateFilesSecurity(editUser, {
                    dossierId: fixture.sourceDossierId,
                    fileIds: [fixture.sourceFileToMoveId],
                }),
                AppError,
            ) as AppError;

            assertEquals(error.status, 403);
        });

        await t.step("allowed dossier security with configure_security and ACL", async () => {
            const result = await ArchiveWarehouseService.updateDossierSecurity(securityUser, {
                dossierId: fixture.sourceDossierId,
            });

            assertEquals(result.dossier.id, fixture.sourceDossierId);
        });
    } finally {
        await deleteAclForResource(fixture.fondId);
        await deleteArchiveWarehouseMoveFixture(fixture);
        await deleteTestProject(project.projectCode);
        await db.delete(userRoles).where(eq(userRoles.userId, editUser.id));
        await db.delete(userProfiles).where(eq(userProfiles.id, editUser.id));
        await db.delete(userRoles).where(eq(userRoles.userId, securityUser.id));
        await db.delete(userProfiles).where(eq(userProfiles.id, securityUser.id));
    }
});
