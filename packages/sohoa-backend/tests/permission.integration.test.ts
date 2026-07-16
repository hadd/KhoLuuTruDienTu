import { assertEquals } from "@std/assert";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { roles, userProfiles, userRoles } from "../db/schemas/index.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import { AuthRole, authHelper } from "../modules/auth/auth-helper.ts";
import { Permission } from "../modules/auth/permission-catalog.ts";
import { resolveFolderBrowseScope } from "../modules/folder/folder-browse-scope.ts";
import type { UserWithRoles } from "../libs/plugins/auth-profile.ts";
import { ensureSeededRole } from "./test-role-helper.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";
import { projects } from "../db/schemas/project.ts";

const TEST_PREFIX = `test-perm-${crypto.randomUUID()}`;

async function createUserWithRole(roleId: string, emailKey: string = roleId) {
  const passwordHash = await hashPassword("Test@sohoa2026");
  const [profile] = await db
    .insert(userProfiles)
    .values({
      email: `${TEST_PREFIX}-${emailKey}@test.local`,
      fullName: `Test ${roleId}`,
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

async function ensureCustomRole(roleId: string, permissions: string[]) {
  const rules = JSON.stringify({ permissions, restrictions: [] });
  const existing = await db.query.roles.findFirst({
    where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
  });

  if (existing) {
    await db
      .update(roles)
      .set({ rules, updatedAt: new Date() })
      .where(eq(roles.id, roleId));
    return;
  }

  await db.insert(roles).values({
    id: roleId,
    name: `Test ${roleId}`,
    description: `Custom test role ${roleId}`,
    rules,
    isBaseRole: false,
  });
}

Deno.test(
  {
    name: "permission integration: editor cannot access users.read",
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async () => {
    await ensureSeededRole(AuthRole.EDITOR, "Editor");
    await ensureSeededRole(AuthRole.ADMIN, "Administrator");

    const editor = await createUserWithRole(AuthRole.EDITOR);
    const admin = await createUserWithRole(AuthRole.ADMIN);

    assertEquals(
      authHelper.hasPermission(editor, Permission.DATA_ENTRY_MAKER),
      true,
    );
    assertEquals(
      authHelper.hasPermission(editor, Permission.DOSSIERS_WRITE),
      false,
    );
    assertEquals(
      authHelper.hasPermission(editor, Permission.USERS_READ),
      false,
    );
    assertEquals(authHelper.hasPermission(admin, Permission.USERS_READ), true);
    assertEquals(
      authHelper.hasPermission(admin, Permission.METADATA_TEMPLATES_MANAGE),
      true,
    );
    assertEquals(
      authHelper.hasPermission(admin, Permission.METADATA_PERMISSIONS_MANAGE),
      true,
    );

    try {
      authHelper.checkPermission(editor, Permission.DOSSIERS_WRITE);
      throw new Error("expected forbidden");
    } catch (error) {
      assertEquals(error instanceof Error, true);
      assertEquals(
        (error as Error).message,
        "Permission required: dossiers.write",
      );
    }

    try {
      authHelper.checkPermission(editor, Permission.USERS_READ);
      throw new Error("expected forbidden");
    } catch (error) {
      assertEquals(error instanceof Error, true);
      assertEquals((error as Error).message, "Permission required: users.read");
    }
  },
);

async function createUserWithRoles(roleIds: string[], emailKey: string) {
  const passwordHash = await hashPassword("Test@sohoa2026");
  const [profile] = await db
    .insert(userProfiles)
    .values({
      email: `${TEST_PREFIX}-${emailKey}@test.local`,
      fullName: `Test ${emailKey}`,
      passwordHash,
    })
    .returning();

  for (const roleId of roleIds) {
    await db.insert(userRoles).values({ userId: profile.id, roleId });
  }

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

Deno.test(
  {
    name: "permission integration: multi-role user inherits permissions from any active role",
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async () => {
    await ensureSeededRole(AuthRole.EDITOR, "Editor");
    await ensureSeededRole(AuthRole.ADMIN, "Administrator");

    const multiRoleUser = await createUserWithRoles(
      [AuthRole.EDITOR, AuthRole.ADMIN],
      "editor-admin",
    );

    assertEquals(
      authHelper.hasPermission(multiRoleUser, Permission.FONDS_UPDATE),
      true,
    );
    assertEquals(
      authHelper.hasPermission(multiRoleUser, Permission.FONDS_DELETE),
      true,
    );
    assertEquals(
      authHelper.hasPermission(multiRoleUser, Permission.USERS_READ),
      true,
    );

    authHelper.checkPermission(multiRoleUser, Permission.FONDS_UPDATE);
    authHelper.checkPermission(multiRoleUser, Permission.FONDS_DELETE);
  },
);

Deno.test(
  {
    name: "permission integration: project manager has full access like admin",
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async () => {
    await ensureSeededRole(AuthRole.PROJECT_MANAGER, "Project Manager");

    const projectManager = await createUserWithRole(AuthRole.PROJECT_MANAGER);

    assertEquals(
      authHelper.hasPermission(projectManager, Permission.GROUPS_CREATE),
      true,
    );
    assertEquals(
      authHelper.hasPermission(projectManager, Permission.PROJECTS_UPDATE),
      true,
    );
    assertEquals(
      authHelper.hasPermission(projectManager, Permission.USERS_READ),
      true,
    );
    assertEquals(
      authHelper.hasPermission(projectManager, Permission.ROLES_MANAGE),
      true,
    );
    assertEquals(
      authHelper.hasPermission(
        projectManager,
        Permission.METADATA_PERMISSIONS_MANAGE,
      ),
      true,
    );
    assertEquals(
      authHelper.hasPermission(
        projectManager,
        Permission.METADATA_TEMPLATES_MANAGE,
      ),
      true,
    );

    authHelper.checkAdminOrProjectManager(projectManager);

    try {
      authHelper.checkAdmin(projectManager);
      throw new Error("expected forbidden");
    } catch (error) {
      assertEquals(error instanceof Error, true);
      assertEquals((error as Error).message, "Admin access required");
    }
  },
);

Deno.test(
  {
    name: "folder browse: admin has browse_all, project manager only browse_assigned",
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async () => {
    await ensureSeededRole(AuthRole.ADMIN, "Administrator");
    await ensureSeededRole(AuthRole.PROJECT_MANAGER, "Project Manager");

    const admin = await createUserWithRole(AuthRole.ADMIN, "folder-admin");
    const projectManager = await createUserWithRole(
      AuthRole.PROJECT_MANAGER,
      "folder-pm",
    );

    assertEquals(
      authHelper.hasPermission(admin, Permission.FOLDERS_BROWSE_ALL),
      true,
    );
    assertEquals(
      authHelper.hasPermission(admin, Permission.FOLDERS_BROWSE_ASSIGNED),
      true,
    );

    assertEquals(
      authHelper.hasPermission(projectManager, Permission.FOLDERS_BROWSE_ALL),
      false,
    );
    assertEquals(
      authHelper.hasPermission(
        projectManager,
        Permission.FOLDERS_BROWSE_ASSIGNED,
      ),
      true,
    );

    const adminScope = await resolveFolderBrowseScope(admin);
    assertEquals(adminScope.mode, "global");

    const pmScope = await resolveFolderBrowseScope(projectManager);
    assertEquals(pmScope.mode, "managed");
  },
);

Deno.test(
  {
    name: "folder browse: browse_all wins when combined with browse_assigned",
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async () => {
    const roleId = `${TEST_PREFIX}-browse-both`;
    await ensureCustomRole(roleId, [
      Permission.FOLDERS_BROWSE_ALL,
      Permission.FOLDERS_BROWSE_ASSIGNED,
    ]);

    const user = await createUserWithRole(roleId, "browse-both");
    const scope = await resolveFolderBrowseScope(user);
    assertEquals(scope.mode, "global");
  },
);

Deno.test(
  {
    name: "folder browse: folders.* wins over browse_assigned",
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async () => {
    const roleId = `${TEST_PREFIX}-folders-wildcard`;
    await ensureCustomRole(roleId, [
      "folders.*",
      Permission.FOLDERS_BROWSE_ASSIGNED,
    ]);

    const user = await createUserWithRole(roleId, "folders-wildcard");
    const scope = await resolveFolderBrowseScope(user);
    assertEquals(scope.mode, "global");
  },
);

Deno.test(
  {
    name: "folder browse: browse_assigned with unmanaged projectCode returns 404",
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async () => {
    await ensureSeededRole(AuthRole.PROJECT_MANAGER, "Project Manager");

    const projectManager = await createUserWithRole(
      AuthRole.PROJECT_MANAGER,
      "browse-404-pm",
    );
    const managedProject = await createTestProject();
    const unmanagedProject = await createTestProject();

    await db
      .update(projects)
      .set({ managerId: projectManager.id })
      .where(eq(projects.projectCode, managedProject.projectCode));

    try {
      const managedScope = await resolveFolderBrowseScope(
        projectManager,
        managedProject.projectCode,
      );
      assertEquals(managedScope.mode, "single");
      if (managedScope.mode === "single") {
        assertEquals(managedScope.projectCode, managedProject.projectCode);
      }

      try {
        await resolveFolderBrowseScope(
          projectManager,
          unmanagedProject.projectCode,
        );
        throw new Error("expected not found");
      } catch (error) {
        assertEquals(error instanceof Error, true);
        assertEquals((error as Error).message, "Folder not found");
      }
    } finally {
      await deleteTestProject(managedProject.projectCode);
      await deleteTestProject(unmanagedProject.projectCode);
    }
  },
);
