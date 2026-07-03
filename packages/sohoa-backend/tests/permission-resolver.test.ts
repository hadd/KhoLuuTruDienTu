import { assertEquals } from "@std/assert";
import {
    hasAnyPermissionInRules,
    hasPermissionInRules,
    parseRoleRules,
    resolveEffectivePermissions,
    userRolesHaveDataEntryMakerOnly,
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

Deno.test("validateRoleRulesInput accepts metadata admin permissions", () => {
    const errors = validateRoleRulesInput({
        permissions: [
            Permission.METADATA_TEMPLATES_MANAGE,
            Permission.METADATA_PERMISSIONS_MANAGE,
            Permission.METADATA_EXPORT_PRESETS_MANAGE,
        ],
        restrictions: [],
    });
    assertEquals(errors.length, 0);
});

Deno.test("project manager has full access without restrictions", () => {
    const rules = parseRoleRules(JSON.stringify({
        permissions: ["*"],
        restrictions: [],
    }));
    assertEquals(hasPermissionInRules(rules, Permission.USERS_READ), true);
    assertEquals(hasPermissionInRules(rules, Permission.ROLES_MANAGE), true);
    assertEquals(hasPermissionInRules(rules, Permission.METADATA_PERMISSIONS_MANAGE), true);
    assertEquals(hasPermissionInRules(rules, Permission.GROUPS_CREATE), true);
    assertEquals(hasPermissionInRules(rules, Permission.PROJECTS_UPDATE), true);
});

Deno.test("hasPermissionInRules supports metadata wildcard", () => {
    const rules = parseRoleRules(JSON.stringify({
        permissions: ["metadata.*"],
        restrictions: [],
    }));
    assertEquals(hasPermissionInRules(rules, Permission.METADATA_TEMPLATES_MANAGE), true);
    assertEquals(hasPermissionInRules(rules, Permission.METADATA_PERMISSIONS_MANAGE), true);
    assertEquals(hasPermissionInRules(rules, Permission.METADATA_EXPORT_PRESETS_MANAGE), true);
    assertEquals(hasPermissionInRules(rules, Permission.DOSSIERS_WRITE), false);
});

Deno.test("userRolesHaveDataEntryMakerOnly excludes users with checker permission", () => {
    const makerOnly = [{ role: { rules: JSON.stringify({
        permissions: [Permission.DATA_ENTRY_MAKER],
        restrictions: [],
    }) } }];
    const makerAndChecker = [{ role: { rules: JSON.stringify({
        permissions: [Permission.DATA_ENTRY_MAKER, Permission.DATA_ENTRY_CHECKER],
        restrictions: [],
    }) } }];
    const checkerOnly = [{ role: { rules: JSON.stringify({
        permissions: [Permission.DATA_ENTRY_CHECKER],
        restrictions: [],
    }) } }];
    const wildcard = [{ role: { rules: JSON.stringify({
        permissions: ["*"],
        restrictions: [],
    }) } }];

    assertEquals(userRolesHaveDataEntryMakerOnly(makerOnly), true);
    assertEquals(userRolesHaveDataEntryMakerOnly(makerAndChecker), false);
    assertEquals(userRolesHaveDataEntryMakerOnly(checkerOnly), false);
    assertEquals(userRolesHaveDataEntryMakerOnly(wildcard), false);
});
