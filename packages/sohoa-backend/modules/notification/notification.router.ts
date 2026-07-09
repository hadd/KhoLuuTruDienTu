import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { NotificationInboxService } from "./notification-delivery-service.ts";

export function createNotificationRouter(basePath: string = "/notifications") {
    const tags = ["Notifications"];

    const app = new Elysia({
        name: "notificationRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/",
        async ({ profile, query }) => {
            return await NotificationInboxService.list(profile.id, {
                unreadOnly: query.unreadOnly,
                limit: query.limit,
                offset: query.offset,
            });
        },
        {
            query: t.Object({
                unreadOnly: t.Optional(t.Boolean()),
                limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
                offset: t.Optional(t.Number({ minimum: 0 })),
            }),
            detail: {
                tags,
                summary: "List my notifications",
            },
        },
    );

    app.get(
        "/unread-count",
        async ({ profile }) => {
            return await NotificationInboxService.unreadCount(profile.id);
        },
        {
            detail: {
                tags,
                summary: "Get unread notification count",
            },
        },
    );

    app.post(
        "/:id/read",
        async ({ profile, params }) => {
            return await NotificationInboxService.markRead(profile.id, params.id);
        },
        {
            params: t.Object({ id: IdParam("Notification ID") }),
            detail: {
                tags,
                summary: "Mark notification as read",
            },
        },
    );

    app.post(
        "/read-all",
        async ({ profile }) => {
            return await NotificationInboxService.markAllRead(profile.id);
        },
        {
            detail: {
                tags,
                summary: "Mark all notifications as read",
            },
        },
    );

    return app;
}
