export type ProjectAccessScope =
    | { type: "global" }
    | { type: "managed"; projectCodes: string[] };

/** Project-scoped filtering applies only when the user manages at least one project. */
export function hasProjectScopedAccess(
    scope: ProjectAccessScope,
): scope is { type: "managed"; projectCodes: string[] } {
    return scope.type === "managed" && scope.projectCodes.length > 0;
}
