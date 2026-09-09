import { assertEquals } from "jsr:@std/assert";
import { Permission } from "../modules/auth/permission-catalog.ts";
import { userRolesHavePermission } from "../modules/auth/permission-resolver.ts";

Deno.test("Permission.AUTH_TWO_FACTOR_REQUIRE value is roles.two_factor_require", () => {
    assertEquals(Permission.AUTH_TWO_FACTOR_REQUIRE, "roles.two_factor_require");
});

Deno.test("roles.* wildcard grants AUTH_TWO_FACTOR_REQUIRE permission", () => {
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
    assertEquals(has2FAPerm, true, "roles.* wildcard should grant roles.two_factor_require permission");
});

Deno.test("explicit roles.two_factor_require permission grants 2FA requirement", () => {
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
    assertEquals(has2FAPerm, true, "Explicit roles.two_factor_require should grant 2FA requirement");
});

Deno.test("legacy auth.two_factor_require permission in database role JSON still grants 2FA requirement", () => {
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
    assertEquals(has2FAPerm, true, "Legacy auth.two_factor_require should be normalized and grant 2FA requirement");
});
