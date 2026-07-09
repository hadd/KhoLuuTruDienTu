import { assertEquals, assertExists } from "@std/assert";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import {
    NotificationChannel,
    NotificationType,
} from "../db/schemas/notification-constants.ts";
import {
    notificationConfigs,
    notifications,
} from "../db/schemas/notification.ts";
import { userProfiles, userRoles, roles } from "../db/schemas/index.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import { AuthRole } from "../modules/auth/auth-helper.ts";
import { NotificationConfigService } from "../modules/notification/notification-config-service.ts";
import {
    NotificationDeliveryService,
    NotificationInboxService,
} from "../modules/notification/notification-delivery-service.ts";
import { ensureSeededRole } from "./test-role-helper.ts";

const TEST_PREFIX = `test-notification/${crypto.randomUUID()}`;

async function createUser(roleId: string) {
    const passwordHash = await hashPassword("Test@sohoa2026");
    const [profile] = await db.insert(userProfiles).values({
        email: `${TEST_PREFIX}-${roleId}-${crypto.randomUUID()}@test.local`,
        fullName: `Test ${roleId}`,
        passwordHash,
        active: true,
    }).returning();

    await db.insert(userRoles).values({ userId: profile.id, roleId });
    return profile;
}

async function cleanupTestData(userIds: string[]) {
    for (const userId of userIds) {
        await db.delete(notifications).where(eq(notifications.recipientId, userId));
    }

    await db.update(notificationConfigs)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(isNull(notificationConfigs.deletedAt));
}

Deno.test({
    name: "Notification Configuration Integration Tests",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    await ensureSeededRole(AuthRole.ADMIN, "Administrator");
    await ensureSeededRole(AuthRole.EDITOR, "Editor");
    await ensureSeededRole(AuthRole.QC, "QC");

    const admin = await createUser(AuthRole.ADMIN);
    const editor1 = await createUser(AuthRole.EDITOR);
    const editor2 = await createUser(AuthRole.EDITOR);

    try {
        await t.step("Admin cannot create config without channels", async () => {
            try {
                await NotificationConfigService.create({
                    notificationType: NotificationType.OCR_COMPLETED,
                    channels: [],
                    roleIds: [AuthRole.ADMIN],
                }, admin.id);
                throw new Error("expected validation error");
            } catch (error) {
                assertEquals(error instanceof Error, true);
                assertEquals((error as Error).message, "At least one channel is required");
            }
        });

        await t.step("Admin cannot create config without roles", async () => {
            try {
                await NotificationConfigService.create({
                    notificationType: NotificationType.OCR_COMPLETED,
                    channels: [NotificationChannel.SYSTEM],
                    roleIds: [],
                }, admin.id);
                throw new Error("expected validation error");
            } catch (error) {
                assertEquals(error instanceof Error, true);
                assertEquals((error as Error).message, "At least one role is required");
            }
        });

        await t.step("Admin can create config and receives warning for role without users", async () => {
            const emptyRoleId = `${TEST_PREFIX}-empty-role`;
            await db.insert(roles).values({
                id: emptyRoleId,
                name: "Empty Notification Role",
                description: "Role without users for notification test",
                rules: JSON.stringify({ permissions: [], restrictions: [] }),
                isBaseRole: false,
            }).onConflictDoNothing();

            const created = await NotificationConfigService.create({
                notificationType: NotificationType.OCR_COMPLETED,
                channels: [NotificationChannel.SYSTEM],
                roleIds: [emptyRoleId],
            }, admin.id);

            assertExists(created.id);
            assertEquals(
                created.warnings?.includes('Role "Empty Notification Role" has no active users'),
                true,
            );
        });

        await t.step("Duplicate config is rejected", async () => {
            await NotificationConfigService.create({
                notificationType: NotificationType.DOSSIER_ASSIGNED,
                channels: [NotificationChannel.SYSTEM],
                roleIds: [AuthRole.EDITOR],
            }, admin.id);

            try {
                await NotificationConfigService.create({
                    notificationType: NotificationType.DOSSIER_ASSIGNED,
                    channels: [NotificationChannel.SYSTEM],
                    roleIds: [AuthRole.EDITOR],
                }, admin.id);
                throw new Error("expected duplicate error");
            } catch (error) {
                assertEquals(error instanceof Error, true);
                assertEquals(
                    (error as Error).message,
                    "A notification config with the same type, channels, and roles already exists",
                );
            }
        });

        await t.step("Deactivated config does not create notifications", async () => {
            const editorConfig = await db.query.notificationConfigs.findFirst({
                where: and(
                    eq(notificationConfigs.notificationType, NotificationType.DOSSIER_ASSIGNED),
                    eq(notificationConfigs.dedupeKey, `${NotificationType.DOSSIER_ASSIGNED}|system|editor`),
                    isNull(notificationConfigs.deletedAt),
                ),
                columns: { id: true },
            });
            assertExists(editorConfig);
            await NotificationConfigService.setActive(editorConfig.id, false, admin.id);

            const config = await NotificationConfigService.create({
                notificationType: NotificationType.DOSSIER_ASSIGNED,
                channels: [NotificationChannel.EMAIL],
                roleIds: [AuthRole.QC],
            }, admin.id);

            await NotificationConfigService.setActive(config.id, false, admin.id);

            await NotificationDeliveryService.dispatchDossierAssigned({
                dossierId: crypto.randomUUID(),
                assigneeId: editor1.id,
                workerRole: "CHECKER_1",
                dossierName: "HS-001",
                folderId: crypto.randomUUID(),
            });

            const inbox = await NotificationInboxService.list(editor1.id, {});
            assertEquals(inbox.length, 0);
        });

        await t.step("Active assignment config only notifies assigned editor", async () => {
            const assignmentConfig = await db.query.notificationConfigs.findFirst({
                where: and(
                    eq(notificationConfigs.notificationType, NotificationType.DOSSIER_ASSIGNED),
                    eq(notificationConfigs.dedupeKey, `${NotificationType.DOSSIER_ASSIGNED}|system|editor`),
                    isNull(notificationConfigs.deletedAt),
                ),
                columns: { id: true },
            });
            assertExists(assignmentConfig);
            await NotificationConfigService.setActive(assignmentConfig.id, true, admin.id);

            const dossierId = crypto.randomUUID();
            const folderId = crypto.randomUUID();

            await NotificationDeliveryService.dispatchDossierAssigned({
                dossierId,
                assigneeId: editor1.id,
                workerRole: "MAKER",
                dossierName: "HS-ASSIGNED-1",
                folderId,
            });

            const editor1Inbox = await NotificationInboxService.list(editor1.id, {});
            const editor2Inbox = await NotificationInboxService.list(editor2.id, {});

            assertEquals(editor1Inbox.some((item) => item.entityId === dossierId), true);
            assertEquals(editor2Inbox.some((item) => item.entityId === dossierId), false);
        });

        await t.step("OCR completed creates notification for configured admin", async () => {
            await NotificationConfigService.create({
                notificationType: NotificationType.OCR_COMPLETED,
                channels: [NotificationChannel.SYSTEM],
                roleIds: [AuthRole.ADMIN],
            }, admin.id);

            const dossierId = crypto.randomUUID();
            await NotificationDeliveryService.dispatchOcrCompleted({
                dossierId,
                folderId: crypto.randomUUID(),
                folderPath: `${TEST_PREFIX}/ocr-folder`,
                dossierName: "HS-OCR-1",
            });

            const adminInbox = await NotificationInboxService.list(admin.id, {});
            const ocrNotification = adminInbox.find((item) => item.entityId === dossierId);
            assertExists(ocrNotification);

            const unread = await NotificationInboxService.unreadCount(admin.id);
            assertEquals(unread.count >= 1, true);

            const marked = await NotificationInboxService.markRead(admin.id, ocrNotification.id);
            assertExists(marked.readAt);
        });

        await t.step("User inbox APIs are scoped to current user only", async () => {
            const editor1Count = await NotificationInboxService.unreadCount(editor1.id);
            const editor2Count = await NotificationInboxService.unreadCount(editor2.id);
            assertEquals(editor1Count.count >= 1, true);
            assertEquals(editor2Count.count, 0);

            const allRead = await NotificationInboxService.markAllRead(editor1.id);
            assertEquals(allRead.updatedCount >= 1, true);
        });
    } finally {
        await cleanupTestData([admin.id, editor1.id, editor2.id]);
    }
});
