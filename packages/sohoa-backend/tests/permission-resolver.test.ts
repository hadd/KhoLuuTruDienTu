import { assertEquals } from "@std/assert";
import {
    hasAnyPermissionInRules,
    hasPermissionInRules,
    parseRoleRules,
    resolveEffectivePermissions,
    validateRoleRulesInput,
} from "../modules/auth/permission-resolver.ts";
import { Permission } from "../modules/auth/permission-catalog.ts";

Deno.test("parseRoleRules handles invalid and empty input", () => {
    assertEquals(parseRoleRules(undefined), { permissions: [], restrictions: [] });
    assertEquals(parseRoleRules(""), { permissions: [], restrictions: [] });
    assertEquals(parseRoleRules("{bad json"), { permissions: [], restrictions: [] });
});

Deno.test("hasPermissionInRules supports wildcard and star", () => {
    const adminRules = parseRoleRules(JSON.stringify({ permissions: ["*"], restrictions: [] }));
    assertEquals(hasPermissionInRules(adminRules, Permission.USERS_READ), true);
    assertEquals(hasPermissionInRules(adminRules, Permission.GROUPS_CREATE), true);

    const editorRules = parseRoleRules(JSON.stringify({
        permissions: ["folders.*", "dossiers.read"],
        restrictions: [],
    }));
    assertEquals(hasPermissionInRules(editorRules, Permission.FOLDERS_READ), true);
    assertEquals(hasPermissionInRules(editorRules, Permission.FOLDERS_WRITE), true);
    assertEquals(hasPermissionInRules(editorRules, Permission.DOSSIERS_READ), true);
    assertEquals(hasPermissionInRules(editorRules, Permission.USERS_READ), false);
});

Deno.test("restrictions override grants", () => {
    const rules = parseRoleRules(JSON.stringify({
        permissions: ["*"],
        restrictions: ["users.read"],
    }));
    assertEquals(hasPermissionInRules(rules, Permission.USERS_READ), false);
    assertEquals(hasPermissionInRules(rules, Permission.GROUPS_READ), true);
});

Deno.test("resolveEffectivePermissions expands catalog keys", () => {
    const rules = parseRoleRules(JSON.stringify({
        permissions: ["data-entry.checker", "groups.read"],
        restrictions: [],
    }));
    const resolved = resolveEffectivePermissions(rules);
    assertEquals(resolved.includes(Permission.DATA_ENTRY_CHECKER), true);
    assertEquals(resolved.includes(Permission.GROUPS_READ), true);
    assertEquals(resolved.includes(Permission.USERS_READ), false);
});

Deno.test("hasAnyPermissionInRules", () => {
    const rules = parseRoleRules(JSON.stringify({
        permissions: ["groups.read"],
        restrictions: [],
    }));
    assertEquals(
        hasAnyPermissionInRules(rules, [Permission.USERS_READ, Permission.GROUPS_READ]),
        true,
    );
});

Deno.test("validateRoleRulesInput rejects unknown patterns", () => {
    const errors = validateRoleRulesInput({
        permissions: ["not.a.real.permission"],
        restrictions: [],
    });
    assertEquals(errors.length > 0, true);
});
