import { assertEquals } from "@std/assert";
import { authHelper, AuthRole } from "../modules/auth/auth-helper.ts";
import { userRolesHavePermission } from "../modules/auth/permission-resolver.ts";
import { Permission } from "../modules/auth/permission-catalog.ts";
import type { UserWithRoles } from "../libs/plugins/auth-profile.ts";

Deno.test("Admin total (AuthRole.ADMIN) bypasses 2FA even if permissions grant wildcard or 2FA", () => {
    const adminProfile: UserWithRoles = {
        id: "user-admin-1",
        email: "admin@example.com",
        fullName: "System Admin",
        avatarUrl: null,
        dateOfBirth: null,
        gender: null,
        phone: null,
        address: null,
        active: true,
        lastLoginAt: null,
        passwordHash: "hashed",
        downloadPasswordEncrypted: null,
        downloadPasswordEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        userRoles: [
            {
                id: "ur-1",
                userId: "user-admin-1",
                roleId: AuthRole.ADMIN,
                createdAt: new Date(),
                expiredAt: null,
                role: {
                    id: AuthRole.ADMIN,
                    name: "Admin Tổng",
                    description: "Super Admin",
                    rules: JSON.stringify({ permissions: ["*"], restrictions: [] }),
                    hiddenModules: "[]",
                    hiddenPermissions: "[]",
                    isBaseRole: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null,
                },
            },
        ],
    };

    const isAdmin = authHelper.isAdmin(adminProfile);
    assertEquals(isAdmin, true);

    const requires2FA = !isAdmin && adminProfile.userRoles.length
        ? userRolesHavePermission(adminProfile.userRoles, Permission.AUTH_TWO_FACTOR_REQUIRE)
        : false;

    assertEquals(requires2FA, false);
});

Deno.test("Non-admin user with AUTH_TWO_FACTOR_REQUIRE role STILL triggers 2FA", () => {
    const normalUserWith2FA: UserWithRoles = {
        id: "user-regular-1",
        email: "user@example.com",
        fullName: "Regular User",
        avatarUrl: null,
        dateOfBirth: null,
        gender: null,
        phone: null,
        address: null,
        active: true,
        lastLoginAt: null,
        passwordHash: "hashed",
        downloadPasswordEncrypted: null,
        downloadPasswordEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        userRoles: [
            {
                id: "ur-2",
                userId: "user-regular-1",
                roleId: "editor_role",
                createdAt: new Date(),
                expiredAt: null,
                role: {
                    id: "editor_role",
                    name: "Editor",
                    description: "Regular editor",
                    rules: JSON.stringify({ permissions: [Permission.AUTH_TWO_FACTOR_REQUIRE], restrictions: [] }),
                    hiddenModules: "[]",
                    hiddenPermissions: "[]",
                    isBaseRole: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null,
                },
            },
        ],
    };

    const isAdmin = authHelper.isAdmin(normalUserWith2FA);
    assertEquals(isAdmin, false);

    const requires2FA = !isAdmin && normalUserWith2FA.userRoles.length
        ? userRolesHavePermission(normalUserWith2FA.userRoles, Permission.AUTH_TWO_FACTOR_REQUIRE)
        : false;

    assertEquals(requires2FA, true);
});
