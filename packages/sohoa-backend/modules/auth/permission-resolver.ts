import {
    ALL_PERMISSION_KEYS,
    DASHBOARD_OVERVIEW_SECTION_PERMISSIONS,
    DASHBOARD_PERSONAL_EDITOR_PERMISSIONS,
    DASHBOARD_PERSONAL_QC_PERMISSIONS,
    DASHBOARD_TEAM_SECTION_PERMISSIONS,
    DASHBOARD_WAREHOUSE_SECTION_PERMISSIONS,
    isKnownPermissionKey,
    isValidPermissionPattern,
    Permission,
    type PermissionKey,
} from "./permission-catalog.ts";

export interface RoleRules {
    permissions: string[];
    restrictions: string[];
    hidden: string[];
}

const EMPTY_RULES: RoleRules = { permissions: [], restrictions: [], hidden: [] };

export function parseRoleRules(rulesJson: any): RoleRules {
    if (!rulesJson) {
        return { ...EMPTY_RULES };
    }

    let parsed: Partial<RoleRules> = {};

    if (typeof rulesJson === "string") {
        if (!rulesJson.trim()) {
            return { ...EMPTY_RULES };
        }
        try {
            parsed = (JSON.parse(rulesJson) || {}) as Partial<RoleRules>;
        } catch {
            return { ...EMPTY_RULES };
        }
    } else if (typeof rulesJson === "object") {
        parsed = rulesJson as Partial<RoleRules>;
    } else {
        return { ...EMPTY_RULES };
    }

    const permissions = Array.isArray(parsed.permissions)
        ? parsed.permissions.filter((p): p is string => typeof p === "string")
        : [];
    const restrictions = Array.isArray(parsed.restrictions)
        ? parsed.restrictions.filter((r): r is string => typeof r === "string")
        : [];
    const hidden = Array.isArray(parsed.hidden)
        ? parsed.hidden.filter((h): h is string => typeof h === "string")
        : [];
    return { permissions, restrictions, hidden };
}

/** Old borrow keys & 2FA key → current keys (role JSON may still use legacy). */
const LEGACY_PERMISSION_ALIASES: Record<string, string> = {
    "archive.borrow.request": Permission.ARCHIVE_BORROW_REQUEST,
    "archive.borrow.review": Permission.ARCHIVE_BORROW_REVIEW,
    "roles.two_factor_require": Permission.AUTH_TWO_FACTOR_REQUIRE,
    "auth.two_factor_require": Permission.AUTH_TWO_FACTOR_REQUIRE,
    "dashboard.admin.summary": Permission.DASHBOARD_OVERVIEW_SUMMARY,
    "dashboard.admin.dossier_status_chart": Permission.DASHBOARD_OVERVIEW_DOSSIER_STATUS_CHART,
    "dashboard.admin.project_status_chart": Permission.DASHBOARD_OVERVIEW_PROJECT_STATUS_CHART,
    "dashboard.admin.dossier_trend_chart": Permission.DASHBOARD_OVERVIEW_DOSSIER_TREND_CHART,
    "dashboard.admin.system_performance": Permission.DASHBOARD_OVERVIEW_SYSTEM_PERFORMANCE,
    "dashboard.admin.employee_kpis": Permission.DASHBOARD_TEAM_EMPLOYEE_KPIS,
    "dashboard.admin.group_performance_chart": Permission.DASHBOARD_TEAM_GROUP_PERFORMANCE,
};

/** Legacy page/parent grants expand to modular section keys. */
const LEGACY_GRANT_EXPANSIONS: Record<string, readonly string[]> = {
    "dashboard.editor": DASHBOARD_PERSONAL_EDITOR_PERMISSIONS,
    "dashboard.qc": [
        ...DASHBOARD_PERSONAL_QC_PERMISSIONS,
        Permission.DASHBOARD_TEAM_QC_GROUP,
    ],
    "dashboard.admin": [
        Permission.DASHBOARD_OVERVIEW,
        ...DASHBOARD_OVERVIEW_SECTION_PERMISSIONS,
        Permission.DASHBOARD_TEAM,
        Permission.DASHBOARD_TEAM_EMPLOYEE_KPIS,
        Permission.DASHBOARD_TEAM_GROUP_PERFORMANCE,
        Permission.DASHBOARD_ADMIN_UNASSIGNED,
        Permission.DASHBOARD_ADMIN_READ_ALL,
    ],
    "dashboard.personal": [
        ...DASHBOARD_PERSONAL_EDITOR_PERMISSIONS,
        ...DASHBOARD_PERSONAL_QC_PERMISSIONS,
    ],
    "dashboard.team": DASHBOARD_TEAM_SECTION_PERMISSIONS,
    "dashboard.overview": DASHBOARD_OVERVIEW_SECTION_PERMISSIONS,
    "dashboard.warehouse": DASHBOARD_WAREHOUSE_SECTION_PERMISSIONS,
};

function normalizePermissionKey(key: string): string {
    return LEGACY_PERMISSION_ALIASES[key] ?? key;
}

function patternMatches(permission: string, pattern: string): boolean {
    if (pattern === "*") return true;

    const normalizedPermission = normalizePermissionKey(permission);
    const normalizedPattern = pattern.endsWith(".*")
        ? pattern
        : normalizePermissionKey(pattern);

    if (normalizedPattern === normalizedPermission) return true;
    if (pattern === permission) return true;

    if (pattern.endsWith(".*")) {
        const prefix = pattern.slice(0, -2);
        if (prefix === "archive.borrow") {
            return normalizedPermission.startsWith("library.borrow.");
        }
        return (
            normalizedPermission.startsWith(`${prefix}.`) ||
            permission.startsWith(`${prefix}.`)
        );
    }

    const expansion = LEGACY_GRANT_EXPANSIONS[normalizedPattern]
        ?? LEGACY_GRANT_EXPANSIONS[pattern];
    if (expansion) {
        return expansion.some(
            (expanded) =>
                expanded === normalizedPermission || expanded === permission,
        );
    }

    return false;
}

function isRestricted(permission: string, restrictions: string[]): boolean {
    return restrictions.some((r) => patternMatches(permission, r));
}

function isGranted(permission: string, permissions: string[]): boolean {
    return permissions.some((p) => patternMatches(permission, p));
}

export function isHiddenByPatterns(permission: string, hidden: string[]): boolean {
    return hidden.some((h) => patternMatches(permission, h));
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

export type UserRoleWithRules = {
    role: {
        rules: string | null | undefined;
        hiddenPermissions?: string | unknown;
    };
};

export function parseHiddenPermissions(hiddenPermissions: unknown): string[] {
    if (!hiddenPermissions) return [];
    if (Array.isArray(hiddenPermissions)) {
        return hiddenPermissions.filter((p): p is string => typeof p === "string");
    }
    if (typeof hiddenPermissions === "string" && hiddenPermissions.trim()) {
        try {
            const parsed = JSON.parse(hiddenPermissions);
            return Array.isArray(parsed)
                ? parsed.filter((p): p is string => typeof p === "string")
                : [];
        } catch {
            return [];
        }
    }
    return [];
}

export function isReadPermission(permission: string): boolean {
    return (
        permission.endsWith(".read") ||
        permission.endsWith(".read_all") ||
        permission.endsWith(".browse_all") ||
        permission.endsWith(".browse_assigned") ||
        permission.endsWith(".search") ||
        permission.startsWith("dashboard.") ||
        permission === Permission.SEARCH_GLOBAL
    );
}

export function userRoleHasPermission(
    userRole: UserRoleWithRules,
    permission: string,
): boolean {
    const rules = parseRoleRules(userRole.role.rules);
    if (isRestricted(permission, rules.restrictions)) {
        return false;
    }

    const hasRolesManage = isGranted(Permission.ROLES_MANAGE, rules.permissions);
    if (hasRolesManage && isReadPermission(permission)) {
        return true;
    }

    return isGranted(permission, rules.permissions);
}

export function userRolesHavePermission(
    userRoles: ReadonlyArray<UserRoleWithRules>,
    permission: string,
): boolean {
    return userRoles.some((userRole) => userRoleHasPermission(userRole, permission));
}

export function userRolesHaveAnyPermission(
    userRoles: ReadonlyArray<UserRoleWithRules>,
    permissions: readonly string[],
): boolean {
    return permissions.some((permission) =>
        userRolesHavePermission(userRoles, permission),
    );
}

export function resolveEffectiveHiddenFromUserRoles(
    userRoles: ReadonlyArray<UserRoleWithRules>,
): string[] {
    const merged = new Set<string>();
    for (const userRole of userRoles) {
        const rules = parseRoleRules(userRole.role.rules);
        for (const key of rules.hidden) {
            merged.add(key);
        }
    }
    return [...merged];
}

export function userRolesHidePermission(
    userRoles: ReadonlyArray<UserRoleWithRules>,
    permission: string,
): boolean {
    return isHiddenByPatterns(permission, resolveEffectiveHiddenFromUserRoles(userRoles));
}

export function resolveEffectivePermissionsFromUserRoles(
    userRoles: ReadonlyArray<UserRoleWithRules>,
): PermissionKey[] {
    return ALL_PERMISSION_KEYS.filter((key) =>
        userRolesHavePermission(userRoles, key),
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
    for (const h of rules.hidden ?? []) {
        if (!isValidPermissionPattern(h) && !isKnownPermissionKey(h)) {
            errors.push(`Invalid hidden pattern: ${h}`);
        }
    }
    return errors;
}

export function serializeRoleRules(rules: RoleRules): string {
    return JSON.stringify({
        permissions: rules.permissions,
        restrictions: rules.restrictions,
        hidden: rules.hidden ?? [],
    });
}

export function parseRulesForResponse(rulesJson: string | null | undefined): RoleRules {
    const parsed = parseRoleRules(rulesJson);
    return {
        permissions: parsed.permissions.filter(isValidPermissionPattern),
        restrictions: parsed.restrictions.filter((r) => isValidPermissionPattern(r) || isKnownPermissionKey(r)),
        hidden: parsed.hidden.filter((h) => isValidPermissionPattern(h) || isKnownPermissionKey(h)),
    };
}
