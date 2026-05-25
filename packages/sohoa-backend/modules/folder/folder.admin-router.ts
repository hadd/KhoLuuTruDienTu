import { Elysia } from "elysia";
import { FolderService as service } from "./folder-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";

const adminRoles = ["admin"];

export function createFolderAdminRouter(basePath: string = "/folders") {
    const tags = ["Admin", "Folder"];

    const app = new Elysia({
        name: "folderAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/tree",
        async ({ profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.getFullFolderTree();
        },
        {
            detail: {
                tags,
                summary: "Get full folder tree with dossiers and files",
                description:
                    "Admin only. Returns the complete folder hierarchy: folders → subfolders → dossiers → files.",
            },
        },
    );

    return app;
}
