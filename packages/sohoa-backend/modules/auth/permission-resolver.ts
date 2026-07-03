import {
    ALL_PERMISSION_KEYS,
    isKnownPermissionKey,
    isValidPermissionPattern,
    Permission,
    type PermissionKey,
} from "./permission-catalog.ts";

export interface RoleRules {
    permissions: string[];
    restrictions: string[];
}

const EMPTY_RULES: RoleRules = { permissions: [], restrictions: [] };

export function parseRoleRules(rulesJson: string | null | undefined): RoleRules {
    if (!rulesJson?.trim()) {
        return { ...EMPTY_RULES };
    }
    try {
        const parsed = JSON.parse(rulesJson) as Partial<RoleRules>;
        const permissions = Array.isArray(parsed.permissions)
            ? parsed.permissions.filter((p): p is string => typeof p === "string")
            : [];
        const restrictions = Array.isArray(parsed.restrictions)
            ? parsed.restrictions.filter((r): r is string => typeof r === "string")
            : [];
        return { permissions, restrictions };
    } catch {
        return { ...EMPTY_RULES };
    }
}

function patternMatches(permission: string, pattern: string): boolean {
    if (pattern === "*") return true;
    if (pattern === permission) return true;
    if (pattern.endsWith(".*")) {
        const prefix = pattern.slice(0, -2);
        return permission.startsWith(`${prefix}.`);
    }
    return false;
}

function isRestricted(permission: string, restrictions: string[]): boolean {
    return restrictions.some((r) => patternMatches(permission, r));
}

function isGranted(permission: string, permissions: string[]): boolean {
    return permissions.some((p) => patternMatches(permission, p));
}

export function hasPermissionInRules(rules: RoleRules, permission: string): boolean {
    if (isRestricted(permission, rules.restrictions)) {
        return false;
    }
    return isGranted(permission, rules.permissions);
}

export function hasAnyPermissionInRules(rules: RoleRules, permissions: string[]): boolean {
    return permissions.some((p) => hasPermissionInRules(rules, p));
}

type UserRoleWithRules = {
    role: { rules: string | null | undefined };
};

export function userRolesHavePermission(
    userRoles: ReadonlyArray<UserRoleWithRules>,
    permission: string,
): boolean {
    return userRoles.some((userRole) =>
        hasPermissionInRules(parseRoleRules(userRole.role.rules), permission),
    );
}

/** User has maker permission and does not also have checker (across all active roles). */
export function userRolesHaveDataEntryMakerOnly(
    userRoles: ReadonlyArray<UserRoleWithRules>,
): boolean {
    return userRolesHavePermission(userRoles, Permission.DATA_ENTRY_MAKER)
        && !userRolesHavePermission(userRoles, Permission.DATA_ENTRY_CHECKER);
}

export function resolveEffectivePermissions(rules: RoleRules): PermissionKey[] {
    const granted = ALL_PERMISSION_KEYS.filter((key) => hasPermissionInRules(rules, key));
    return granted;
}

export function validateRoleRulesInput(rules: RoleRules): string[] {
    const errors: string[] = [];
    for (const p of rules.permissions) {
        if (!isValidPermissionPattern(p)) {
            errors.push(`Invalid permission pattern: ${p}`);
        }
    }
    for (const r of rules.restrictions) {
        if (!isValidPermissionPattern(r) && !isKnownPermissionKey(r)) {
            errors.push(`Invalid restriction: ${r}`);
        }
    }
    return errors;
}

export function serializeRoleRules(rules: RoleRules): string {
    return JSON.stringify(rules);
}

export function parseRulesForResponse(rulesJson: string | null | undefined): RoleRules {
    return parseRoleRules(rulesJson);
}
