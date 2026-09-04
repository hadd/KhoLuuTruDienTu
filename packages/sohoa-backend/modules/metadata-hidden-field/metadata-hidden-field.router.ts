import { Elysia, t } from "elysia";
import { MetadataHiddenFieldService } from "./metadata-hidden-field-service.ts";

export function createMetadataHiddenFieldRouter(
    basePath: string = "/metadata-hidden-fields"
) {
    return new Elysia({ prefix: basePath })
        .get("/", async () => {
            const data = await MetadataHiddenFieldService.getAll();
            return { success: true, data };
        })
        .get("/active", async () => {
            const activeHiddenFields =
                await MetadataHiddenFieldService.getActiveHiddenFields();
            return { success: true, activeHiddenFields };
        })
        .post(
            "/",
            async ({ body }) => {
                const data = await MetadataHiddenFieldService.create(body);
                return { success: true, data };
            },
            {
                body: t.Object({
                    fieldCode: t.String(),
                    groupCode: t.Optional(t.Nullable(t.String())),
                    description: t.Optional(t.Nullable(t.String())),
                    isHidden: t.Optional(t.Boolean()),
                }),
            }
        )
        .put(
            "/:id",
            async ({ params, body }) => {
                const data = await MetadataHiddenFieldService.update(
                    params.id,
                    body
                );
                return { success: true, data };
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
                body: t.Object({
                    fieldCode: t.Optional(t.String()),
                    groupCode: t.Optional(t.Nullable(t.String())),
                    description: t.Optional(t.Nullable(t.String())),
                    isHidden: t.Optional(t.Boolean()),
                }),
            }
        )
        .delete(
            "/:id",
            async ({ params }) => {
                const data = await MetadataHiddenFieldService.delete(
                    params.id
                );
                return { success: true, data };
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
            }
        );
}
