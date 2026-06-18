import { Elysia } from "elysia";
import { FolderService as service } from "./folder-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";

export function createFolderAdminRouter(basePath: string = "/folders") {
    const tags = ["Admin", "Folder"];

    const app = new Elysia({
        name: "folderAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.urlQuery);

    app.get(
        "/tree",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.FOLDERS_TREE);
            return await service.getFullFolderTree(urlQuery.projectCode);
        },
        {
            detail: {
                tags,
                summary: "Get full folder tree with dossiers and files",
                description:
                    "Requires folders.tree. Returns the complete folder hierarchy: folders → subfolders → dossiers → files. Optional projectCode filters by project.",
            },
        },
    );

    return app;
}
