import { assertEquals, assertExists } from "@std/assert";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import {
    NotificationChannel,
    NotificationType,
    type NotificationChannelValue,
} from "../db/schemas/notification-constants.ts";
import { deleteEmailSenderConfig } from "../libs/email-config.ts";
import {
    notificationConfigs,
    notifications,
} from "../db/schemas/notification.ts";
import { userProfiles, userRoles, roles } from "../db/schemas/index.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import { AuthRole } from "../modules/auth/auth-helper.ts";
import { EmailSenderConfigService } from "../modules/notification/email-sender-config-service.ts";
import { NotificationConfigService } from "../modules/notification/notification-config-service.ts";
import {
    NotificationDeliveryService,
    NotificationInboxService,
} from "../modules/notification/notification-delivery-service.ts";
import { configsMatch } from "../modules/notification/notification-resolver.ts";
import { ensureSeededRole } from "./test-role-helper.ts";

const TEST_RUN_ID = crypto.randomUUID();
const TEST_PREFIX = `test-notification-${TEST_RUN_ID}`;

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

async function findConfig(
    notificationType: string,
    channels: NotificationChannelValue[],
    roleIds: string[],
) {
    const rows = await db.query.notificationConfigs.findMany({
        where: eq(notificationConfigs.notificationType, notificationType),
    });
    return rows.find((row) =>
        configsMatch(
            row.channels as NotificationChannelValue[],
            row.roleIds,
            channels,
            roleIds,
        )
    );
}

function notificationMatchesDossier(
    item: { actionUrl: string },
    dossierId: string,
): boolean {
    return item.actionUrl.includes(dossierId);
}

function findNotificationForDossier(
    items: Array<{ actionUrl: string; body: string; type?: string }>,
    dossierId: string,
    dossierName?: string,
) {
    return items.find((item) =>
        notificationMatchesDossier(item, dossierId) ||
        (dossierName ? item.body.includes(dossierName) : false)
    );
}

async function cleanupTestData(userIds: string[], roleIds: string[] = []) {
    for (const userId of userIds) {
        await db.delete(notifications).where(eq(notifications.recipientId, userId));
    }

    await deleteEmailSenderConfig();
    await db.delete(notificationConfigs).where(isNotNull(notificationConfigs.id));

    if (roleIds.length > 0) {
        await db.update(roles)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(and(inArray(roles.id, roleIds), isNull(roles.deletedAt)));
    }
}

Deno.test({
    name: "Notification Configuration Integration Tests",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    await ensureSeededRole(AuthRole.ADMIN, "Administrator");
    await ensureSeededRole(AuthRole.EDITOR, "Editor");
    await ensureSeededRole(AuthRole.QC, "QC");
    await ensureSeededRole(AuthRole.PROJECT_MANAGER, "Project Manager");

    const admin = await createUser(AuthRole.ADMIN);
    const editor1 = await createUser(AuthRole.EDITOR);
    const editor2 = await createUser(AuthRole.EDITOR);
    const qc1 = await createUser(AuthRole.QC);
    const qc2 = await createUser(AuthRole.QC);
    const pm = await createUser(AuthRole.PROJECT_MANAGER);
    const createdRoleIds: string[] = [];

    try {
        await db.delete(notificationConfigs).where(isNotNull(notificationConfigs.id));

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
            createdRoleIds.push(emptyRoleId);

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
            const editorConfig = await findConfig(
                NotificationType.DOSSIER_ASSIGNED,
                [NotificationChannel.SYSTEM],
                [AuthRole.EDITOR],
            );
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
            const assignmentConfig = await findConfig(
                NotificationType.DOSSIER_ASSIGNED,
                [NotificationChannel.SYSTEM],
                [AuthRole.EDITOR],
            );
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

            const notification = findNotificationForDossier(
                editor1Inbox,
                dossierId,
                "HS-ASSIGNED-1",
            );
            assertExists(notification);
            assertEquals(notification.actionUrl, "/app/data");
            assertEquals(
                editor2Inbox.some((item) => notificationMatchesDossier(item, dossierId)),
                false,
            );
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
            const ocrNotification = adminInbox.find((item) =>
                notificationMatchesDossier(item, dossierId)
            );
            assertExists(ocrNotification);
            assertEquals(ocrNotification.actionUrl, `/app/data?dossierId=${dossierId}`);

            const unread = await NotificationInboxService.unreadCount(admin.id);
            assertEquals(unread.count >= 1, true);

            const marked = await NotificationInboxService.markRead(admin.id, ocrNotification.id);
            assertExists(marked.readAt);
        });

        await t.step("Create config with email channel returns warning when sender not ready", async () => {
            await deleteEmailSenderConfig();

            const created = await NotificationConfigService.create({
                notificationType: NotificationType.OCR_COMPLETED,
                channels: [NotificationChannel.EMAIL],
                roleIds: [AuthRole.ADMIN],
                active: false,
            }, admin.id);

            assertExists(created.warnings);
            assertEquals(
                created.warnings?.some((warning) => warning.includes("Email channel selected but sender is not configured")),
                true,
            );
        });

        await t.step("Activate email config is blocked when sender is not ready", async () => {
            const emailConfig = await findConfig(
                NotificationType.OCR_COMPLETED,
                [NotificationChannel.EMAIL],
                [AuthRole.ADMIN],
            );
            assertExists(emailConfig);

            try {
                await NotificationConfigService.setActive(emailConfig.id, true, admin.id);
                throw new Error("expected activate block");
            } catch (error) {
                assertEquals(error instanceof Error, true);
                assertEquals(
                    (error as Error).message.includes("Cannot activate notification config with email channel"),
                    true,
                );
            }
        });

        await t.step("Upsert sender then activate email config succeeds when infra is ready", async () => {
            await EmailSenderConfigService.upsert({
                smtpProvider: "gmail",
                smtpHost: "smtp.gmail.com",
                fromEmail: "noreply@fsi.vn",
                password: "smtp-test-password",
            }, admin.id);

            const emailConfig = await findConfig(
                NotificationType.OCR_COMPLETED,
                [NotificationChannel.EMAIL],
                [AuthRole.ADMIN],
            );
            assertExists(emailConfig);

            const status = await EmailSenderConfigService.getPublic();
            if (!status.configured) {
                return;
            }

            const { env } = await import("../env.ts");
            if (!env.FRONTEND_URL) {
                try {
                    await NotificationConfigService.setActive(emailConfig.id, true, admin.id);
                    throw new Error("expected FRONTEND_URL activate block");
                } catch (error) {
                    assertEquals(error instanceof Error, true);
                    assertEquals(
                        (error as Error).message.includes("FRONTEND_URL is not configured"),
                        true,
                    );
                }
                return;
            }

            const activated = await NotificationConfigService.setActive(emailConfig.id, true, admin.id);
            assertEquals(activated.active, true);
        });

        await t.step("Email dispatch still creates inbox row when email is not configured", async () => {
            await deleteEmailSenderConfig();

            await NotificationConfigService.create({
                notificationType: NotificationType.DOSSIER_ASSIGNED,
                channels: [NotificationChannel.EMAIL],
                roleIds: [AuthRole.EDITOR],
                active: true,
            }, admin.id);

            const dossierId = crypto.randomUUID();
            await NotificationDeliveryService.dispatchDossierAssigned({
                dossierId,
                assigneeId: editor1.id,
                workerRole: "MAKER",
                dossierName: "HS-EMAIL-FAIL",
                folderId: crypto.randomUUID(),
            });

            const rows = await db.query.notifications.findMany({
                where: and(
                    eq(notifications.recipientId, editor1.id),
                    eq(notifications.type, NotificationType.DOSSIER_ASSIGNED),
                ),
            });
            const notification = rows.find((row) =>
                row.body.includes("HS-EMAIL-FAIL")
            );
            assertExists(notification);
            assertEquals(notification.body.includes("HS-EMAIL-FAIL"), true);
        });

        await t.step("Editors completed notifies only assigned QC", async () => {
            await NotificationConfigService.create({
                notificationType: NotificationType.EDITORS_COMPLETED,
                channels: [NotificationChannel.SYSTEM],
                roleIds: [AuthRole.QC],
            }, admin.id);

            const dossierId = crypto.randomUUID();
            await NotificationDeliveryService.dispatchEditorsCompleted({
                dossierId,
                assigneeId: qc1.id,
                workerRole: "CHECKER_1",
                dossierName: "HS-EDITORS-DONE",
                folderId: crypto.randomUUID(),
                qcStep: 1,
            });

            const qc1Inbox = await NotificationInboxService.list(qc1.id, {});
            const qc2Inbox = await NotificationInboxService.list(qc2.id, {});
            const notification = qc1Inbox.find((item) =>
                notificationMatchesDossier(item, dossierId)
            );
            assertExists(notification);
            assertEquals(notification.type, NotificationType.EDITORS_COMPLETED);
            assertEquals(notification.actionUrl, `/app/data?dossierId=${dossierId}`);
            assertEquals(
                qc2Inbox.some((item) => notificationMatchesDossier(item, dossierId)),
                false,
            );
        });

        await t.step("QC step completed notifies next assigned QC", async () => {
            await NotificationConfigService.create({
                notificationType: NotificationType.QC_STEP_COMPLETED,
                channels: [NotificationChannel.SYSTEM],
                roleIds: [AuthRole.QC],
            }, admin.id);

            const dossierId = crypto.randomUUID();
            await NotificationDeliveryService.dispatchQcStepCompleted({
                dossierId,
                assigneeId: qc2.id,
                workerRole: "CHECKER_2",
                dossierName: "HS-QC-STEP",
                folderId: crypto.randomUUID(),
                completedQcStep: 1,
                nextQcStep: 2,
            });

            const qc2Inbox = await NotificationInboxService.list(qc2.id, {});
            const qc1Inbox = await NotificationInboxService.list(qc1.id, {});
            const notification = qc2Inbox.find((item) =>
                item.type === NotificationType.QC_STEP_COMPLETED &&
                notificationMatchesDossier(item, dossierId)
            );
            assertExists(notification);
            assertEquals(notification.actionUrl, `/app/data?dossierId=${dossierId}`);
            assertEquals(
                qc1Inbox.some((item) =>
                    item.type === NotificationType.QC_STEP_COMPLETED &&
                    notificationMatchesDossier(item, dossierId)
                ),
                false,
            );
        });

        await t.step("Dossier approved notifies project manager only", async () => {
            await NotificationConfigService.create({
                notificationType: NotificationType.DOSSIER_APPROVED,
                channels: [NotificationChannel.SYSTEM],
                roleIds: [AuthRole.PROJECT_MANAGER],
            }, admin.id);

            const dossierId = crypto.randomUUID();
            await NotificationDeliveryService.dispatchDossierApproved({
                dossierId,
                managerId: pm.id,
                dossierName: "HS-APPROVED",
                folderId: crypto.randomUUID(),
            });

            const pmInbox = await NotificationInboxService.list(pm.id, {});
            const adminInbox = await NotificationInboxService.list(admin.id, {});
            const notification = pmInbox.find((item) =>
                notificationMatchesDossier(item, dossierId)
            );
            assertExists(notification);
            assertEquals(notification.type, NotificationType.DOSSIER_APPROVED);
            assertEquals(notification.actionUrl, `/app/data?dossierId=${dossierId}`);
            assertEquals(
                adminInbox.some((item) => notificationMatchesDossier(item, dossierId)),
                false,
            );
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
        await cleanupTestData(
            [admin.id, editor1.id, editor2.id, qc1.id, qc2.id, pm.id],
            createdRoleIds,
        );
    }
});
