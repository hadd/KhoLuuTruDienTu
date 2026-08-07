import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    metadataExtractModeSchema,
    metadataExtractTriggerModeSchema,
} from "../../db/schemas/metadata-extract-settings.ts";
import {
    getMetadataExtractSettings,
    setMetadataExtractMode,
} from "./metadata-extract-settings-service.ts";
import { routeMetadataExtract } from "./metadata-extract-router-service.ts";

export function createMetadataExtractRouter(basePath: string = "/metadata") {
    const tags = ["MetadataExtract"];

    return new Elysia({ name: "metadataExtractRouter", prefix: basePath })
        .use(plugins.authProfile)
        .use(plugins.auditLog)
        .get(
            "/extract-settings",
            async ({ profile }) => {
                authHelper.checkPermission(
                    profile,
                    Permission.METADATA_EXTRACT_SETTINGS_READ,
                );
                return await getMetadataExtractSettings();
            },
            {
                detail: {
                    tags,
                    summary: "Get system-wide metadata extract mode",
                },
            },
        )
        .put(
            "/extract-settings",
            async ({ body, profile }) => {
                authHelper.checkPermission(
                    profile,
                    Permission.METADATA_EXTRACT_SETTINGS_UPDATE,
                );
                return await setMetadataExtractMode(body.mode, profile.id);
            },
            {
                body: t.Object({
                    mode: metadataExtractModeSchema,
                }),
                detail: {
                    tags,
                    summary: "Update system-wide metadata extract mode",
                    description:
                        "Applies to every dossier after merge-finished-wait (old / tt05 / off).",
                },
            },
        )
        .post(
            "/extract",
            async ({ body, profile }) => {
                authHelper.checkPermission(
                    profile,
                    Permission.METADATA_EXTRACT_TRIGGER,
                );
                const result = await routeMetadataExtract({
                    ho_so_id: body.ho_so_id,
                    mode: body.mode,
                    actorId: profile.id,
                });
                return result;
            },
            {
                body: t.Object({
                    ho_so_id: t.String({ minLength: 1 }),
                    mode: metadataExtractTriggerModeSchema,
                }),
                detail: {
                    tags,
                    summary: "Trigger metadata extract (manual / re-extract)",
                    description:
                        "Publishes Kafka messages for old / tt05 / both. Independent of OCR manual trigger.",
                },
            },
        );
}
