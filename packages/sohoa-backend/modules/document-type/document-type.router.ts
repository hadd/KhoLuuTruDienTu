import { Elysia, t } from "elysia";
import { DocumentTypeService as service } from "./document-type-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";

const idParamSchema = t.Object({
    id: t.String({ description: "Mã loại tài liệu" }),
});

export function createDocumentTypeRouter(basePath: string = "/document-types") {
    const meta = service.getMetadata?.();
    const tags = [["DocumentType", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });

    const app = new Elysia({
        name: "documentTypeRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.DOCUMENT_TYPES_READ);
            return await service.list(urlQuery);
        },
        docs.list,
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.DOCUMENT_TYPES_READ);
            const record = await service.get(params.id);
            return { record };
        },
        {
            ...docs.get,
            params: idParamSchema,
        },
    );

    app.post(
        "/",
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.DOCUMENT_TYPES_CREATE);
            const record = await service.create(body);
            set.status = 201;
            return { record, status: "created" };
        },
        docs.create,
    );

    app.put(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOCUMENT_TYPES_UPDATE);
            const record = await service.update(params.id, body);
            return { record, status: "updated" };
        },
        {
            ...docs.update,
            params: idParamSchema,
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.DOCUMENT_TYPES_DELETE);
            const record = await service.delete(params.id);
            return { record, status: "deleted" };
        },
        {
            ...docs.delete,
            params: idParamSchema,
        },
    );

    return app;
}
