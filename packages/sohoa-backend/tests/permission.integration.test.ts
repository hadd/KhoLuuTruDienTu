import { assertEquals } from "@std/assert";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { userProfiles, userRoles } from "../db/schemas/index.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import { AuthRole, authHelper } from "../modules/auth/auth-helper.ts";
import { Permission } from "../modules/auth/permission-catalog.ts";
import type { UserWithRoles } from "../libs/plugins/auth-profile.ts";
import { ensureSeededRole } from "./test-role-helper.ts";

const TEST_PREFIX = `test-perm/${crypto.randomUUID()}`;

async function createUserWithRole(roleId: string) {
    const passwordHash = await hashPassword("Test@sohoa2026");
    const [profile] = await db.insert(userProfiles).values({
        email: `${TEST_PREFIX}-${roleId}@test.local`,
        fullName: `Test ${roleId}`,
        passwordHash,
    }).returning();

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

Deno.test({
    name: "permission integration: editor cannot access users.read",
    sanitizeResources: false,
    sanitizeOps: false,
}, async () => {
    await ensureSeededRole(AuthRole.EDITOR, "Editor");
    await ensureSeededRole(AuthRole.ADMIN, "Administrator");

    const editor = await createUserWithRole(AuthRole.EDITOR);
    const admin = await createUserWithRole(AuthRole.ADMIN);

    assertEquals(authHelper.hasPermission(editor, Permission.DATA_ENTRY_MAKER), true);
    assertEquals(authHelper.hasPermission(editor, Permission.DOSSIERS_WRITE), false);
    assertEquals(authHelper.hasPermission(editor, Permission.USERS_READ), false);
    assertEquals(authHelper.hasPermission(admin, Permission.USERS_READ), true);
    assertEquals(authHelper.hasPermission(admin, Permission.METADATA_TEMPLATES_MANAGE), true);
    assertEquals(authHelper.hasPermission(admin, Permission.METADATA_PERMISSIONS_MANAGE), true);

    try {
        authHelper.checkPermission(editor, Permission.DOSSIERS_WRITE);
        throw new Error("expected forbidden");
    } catch (error) {
        assertEquals(error instanceof Error, true);
        assertEquals((error as Error).message, "Permission required: dossiers.write");
    }

    try {
        authHelper.checkPermission(editor, Permission.USERS_READ);
        throw new Error("expected forbidden");
    } catch (error) {
        assertEquals(error instanceof Error, true);
        assertEquals((error as Error).message, "Permission required: users.read");
    }
});
