import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    notificationChannelSchema,
    notificationTypeSchema,
} from "../../db/schemas/notification-constants.ts";
import { NotificationConfigService } from "./notification-config-service.ts";
import { EmailSenderConfigService } from "./email-sender-config-service.ts";

export function createNotificationConfigAdminRouter(
    basePath: string = "/notification-configs",
) {
    const tags = ["Admin", "NotificationConfig"];

    const app = new Elysia({
        name: "notificationConfigAdminRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .use(plugins.auditLog);

    app.get(
        "/",
        async ({ profile, query }) => {
            authHelper.checkPermission(profile, Permission.NOTIFICATIONS_CONFIG_MANAGE);
            return await NotificationConfigService.list({
                notificationType: query.notificationType,
                channel: query.channel,
                roleId: query.roleId,
                active: query.active,
                search: query.search,
            });
        },
        {
            query: t.Object({
                notificationType: t.Optional(notificationTypeSchema),
                channel: t.Optional(notificationChannelSchema),
                roleId: t.Optional(t.String()),
                active: t.Optional(t.Boolean()),
                search: t.Optional(t.String()),
            }),
            detail: {
                tags,
                summary: "List notification configs",
            },
        },
    );

    app.post(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.NOTIFICATIONS_CONFIG_MANAGE);
            return await NotificationConfigService.create(body, profile.id);
        },
        {
            body: t.Object({
                notificationType: notificationTypeSchema,
                channels: t.Array(notificationChannelSchema, { minItems: 1 }),
                roleIds: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
                active: t.Optional(t.Boolean()),
            }),
            detail: {
                tags,
                summary: "Create notification config",
            },
        },
    );

    app.get(
        "/email-sender",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.NOTIFICATIONS_CONFIG_MANAGE);
            return await EmailSenderConfigService.getPublic();
        },
        {
            detail: {
                tags,
                summary: "Get email sender configuration status",
            },
        },
    );

    app.put(
        "/email-sender",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.NOTIFICATIONS_CONFIG_MANAGE);
            return await EmailSenderConfigService.upsert(body, profile.id);
        },
        {
            body: t.Object({
                fromEmail: t.String({ minLength: 1 }),
                fromName: t.Optional(t.Nullable(t.String())),
                replyTo: t.Optional(t.Nullable(t.String())),
                password: t.Optional(t.String()),
            }),
            detail: {
                tags,
                summary: "Upsert email sender identity",
            },
        },
    );

    app.post(
        "/email-sender/test-send",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.NOTIFICATIONS_CONFIG_MANAGE);
            return await EmailSenderConfigService.testSend(body.to, profile.email);
        },
        {
            body: t.Object({
                to: t.Optional(t.String()),
            }),
            detail: {
                tags,
                summary: "Send test email using configured sender",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.NOTIFICATIONS_CONFIG_MANAGE);
            return await NotificationConfigService.get(params.id);
        },
        {
            params: t.Object({ id: IdParam("Notification config ID") }),
            detail: {
                tags,
                summary: "Get notification config by ID",
            },
        },
    );

    app.patch(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.NOTIFICATIONS_CONFIG_MANAGE);
            return await NotificationConfigService.update(params.id, body, profile.id);
        },
        {
            params: t.Object({ id: IdParam("Notification config ID") }),
            body: t.Object({
                notificationType: notificationTypeSchema,
                channels: t.Array(notificationChannelSchema, { minItems: 1 }),
                roleIds: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
                active: t.Optional(t.Boolean()),
            }),
            detail: {
                tags,
                summary: "Update notification config",
            },
        },
    );

    app.post(
        "/:id/activate",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.NOTIFICATIONS_CONFIG_MANAGE);
            return await NotificationConfigService.setActive(params.id, true, profile.id);
        },
        {
            params: t.Object({ id: IdParam("Notification config ID") }),
            detail: {
                tags,
                summary: "Activate notification config",
            },
        },
    );

    app.post(
        "/:id/deactivate",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.NOTIFICATIONS_CONFIG_MANAGE);
            return await NotificationConfigService.setActive(params.id, false, profile.id);
        },
        {
            params: t.Object({ id: IdParam("Notification config ID") }),
            detail: {
                tags,
                summary: "Deactivate notification config",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.NOTIFICATIONS_CONFIG_MANAGE);
            return await NotificationConfigService.remove(params.id, profile.id);
        },
        {
            params: t.Object({ id: IdParam("Notification config ID") }),
            detail: {
                tags,
                summary: "Delete notification config",
            },
        },
    );

    return app;
}
