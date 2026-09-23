import { assertEquals } from "jsr:@std/assert";
import { Permission } from "../modules/auth/permission-catalog.ts";
import { userRolesHavePermission } from "../modules/auth/permission-resolver.ts";

Deno.test("Permission.AUTH_TWO_FACTOR_REQUIRE value is auth.two_factor_require", () => {
    assertEquals(Permission.AUTH_TWO_FACTOR_REQUIRE, "auth.two_factor_require");
});

Deno.test("roles.* wildcard does NOT grant AUTH_TWO_FACTOR_REQUIRE (independent modules)", () => {
    const userRoles = [
        {
            role: {
                rules: JSON.stringify({
                    permissions: ["roles.*"],
                    restrictions: [],
                }),
            },
        },
    ];

    const has2FAPerm = userRolesHavePermission(userRoles, Permission.AUTH_TWO_FACTOR_REQUIRE);
    assertEquals(has2FAPerm, false, "roles.* wildcard should NOT grant 2FA requirement");

    const hasRolesManage = userRolesHavePermission(userRoles, Permission.ROLES_MANAGE);
    assertEquals(hasRolesManage, true, "roles.* wildcard grants roles.manage");
});

Deno.test("explicit auth.two_factor_require permission grants 2FA requirement", () => {
    const userRoles = [
        {
            role: {
                rules: JSON.stringify({
                    permissions: ["roles.manage", "auth.two_factor_require"],
                    restrictions: [],
                }),
            },
        },
    ];

    const has2FAPerm = userRolesHavePermission(userRoles, Permission.AUTH_TWO_FACTOR_REQUIRE);
    assertEquals(has2FAPerm, true, "Explicit auth.two_factor_require should grant 2FA requirement");

    const hasRolesManage = userRolesHavePermission(userRoles, Permission.ROLES_MANAGE);
    assertEquals(hasRolesManage, true, "roles.manage remains granted");
});

Deno.test("turning off 2FA does NOT affect roles.manage", () => {
    const userRoles = [
        {
            role: {
                rules: JSON.stringify({
                    permissions: ["roles.manage"],
                    restrictions: [],
                }),
            },
        },
    ];

    const has2FAPerm = userRolesHavePermission(userRoles, Permission.AUTH_TWO_FACTOR_REQUIRE);
    assertEquals(has2FAPerm, false, "2FA is not required");

    const hasRolesManage = userRolesHavePermission(userRoles, Permission.ROLES_MANAGE);
    assertEquals(hasRolesManage, true, "roles.manage remains granted even without 2FA");
});

Deno.test("legacy roles.two_factor_require permission in database role JSON still grants 2FA requirement", () => {
    const userRoles = [
        {
            role: {
                rules: JSON.stringify({
                    permissions: ["roles.manage", "roles.two_factor_require"],
                    restrictions: [],
                }),
            },
        },
    ];

    const has2FAPerm = userRolesHavePermission(userRoles, Permission.AUTH_TWO_FACTOR_REQUIRE);
    assertEquals(has2FAPerm, true, "Legacy roles.two_factor_require should be normalized and grant 2FA requirement");
});

