import { Elysia, t } from "elysia";
import { ProfileService as service, stripProfileSecrets } from "./profile-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { updateUserProfileSchema } from "../../db/schemas/user_profile.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { isNull } from "drizzle-orm";

export function createProfileRouter(_basePath: string = "/users") {
    const meta = service.getMetadata?.();
    const tags = [["My Profile", ...(meta?.tags || [])].join(" ")];

    return new Elysia({
        name: "profile-router",
        prefix: _basePath,
    })
        .use(plugins.authProfile)
        .get(
            "/profile",
            async ({ profile }) => {
                const record = await service.get(profile.id, {
                    with: {
                        userRoles: {
                            where: isNull(userRoles.expiredAt),
                            with: {
                                role: true,
                            },
                        },
                    },
                });
                return { record: stripProfileSecrets(record as { passwordHash?: string | null }) };
            },
            {
                detail: {
                    tags,
                    summary: "Get my profile",
                    description: "Returns the current user's profile information.",
                },
                response: {
                    200: t.Object({
                        record: t.Any(),
                    }),
                },
            }
        )
        .put(
            "/profile",
            async ({ profile, body }) => {
                const record = await service.updateMyProfile(profile.id, body);
                return { record, status: "updated" };
            },
            {
                body: updateUserProfileSchema,
                detail: {
                    tags,
                    summary: "Update my profile",
                    description: "Updates the current user's profile information. Email cannot be modified here.",
                },
                response: {
                    200: t.Object({
                        record: t.Any(),
                        status: t.String(),
                    }),
                },
            }
        );
}
