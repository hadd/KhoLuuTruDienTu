import { httpError } from "@shared/common-lib";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { projectAccessHelper } from "../auth/project-access-helper.ts";
import { userRolesHavePermission } from "../auth/permission-resolver.ts";
import { ProjectService } from "../project/project-service.ts";

/**
 * Scope of a folder-browse request, resolved from the caller's folder
 * permissions and optional projectCode filter.
 *
 * - `global`: browse everything (permission `folders.browse_all`).
 * - `single`: browse a single project (explicit projectCode).
 * - `managed`: browse only projects the caller manages
 *   (permission `folders.browse_assigned`).
 */
export type FolderBrowseScope =
  | { mode: "global" }
  | { mode: "single"; projectCode: string }
  | { mode: "managed"; projectCodes: string[] };

/** Browse the entire system (equivalent to `folders.browse_all`). */
export const GLOBAL_BROWSE_SCOPE: FolderBrowseScope = { mode: "global" };

function profileHasBrowseAll(profile: UserWithRoles): boolean {
  return userRolesHavePermission(
    profile.userRoles,
    Permission.FOLDERS_BROWSE_ALL,
  );
}

function profileHasBrowseAssigned(profile: UserWithRoles): boolean {
  return userRolesHavePermission(
    profile.userRoles,
    Permission.FOLDERS_BROWSE_ASSIGNED,
  );
}

/**
 * Resolve the folder-browse scope for the current profile.
 *
 * Requires at least one of `folders.browse_all` / `folders.browse_assigned`.
 * When a projectCode is supplied the request is scoped to that single project;
 * callers with only `browse_assigned` must manage that project. When no
 * projectCode is supplied the scope is `global` for `browse_all`, otherwise
 * limited to the projects the caller manages.
 */
export async function resolveFolderBrowseScope(
  profile: UserWithRoles,
  projectCode?: string,
): Promise<FolderBrowseScope> {
  const hasBrowseAll = profileHasBrowseAll(profile);
  const hasBrowseAssigned = profileHasBrowseAssigned(profile);

  if (!hasBrowseAll && !hasBrowseAssigned) {
    throw httpError.forbidden("Folder browse permission required");
  }

  if (projectCode) {
    await ProjectService.assertProjectExists(projectCode);
    if (!hasBrowseAll) {
      await projectAccessHelper.assertCanBrowseProject(profile, projectCode);
    }
    return { mode: "single", projectCode };
  }

  if (hasBrowseAll) {
    return { mode: "global" };
  }

  const projectCodes = await projectAccessHelper.getManagedProjectCodes(
    profile.id,
  );
  return { mode: "managed", projectCodes };
}
