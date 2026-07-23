import { assertEquals, assertExists } from "@std/assert";
import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { deleteEmailSenderConfig } from "../libs/email-config.ts";
import { userProfiles, userRoles } from "../db/schemas/index.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import { AuthRole } from "../modules/auth/auth-helper.ts";
import { EmailSenderConfigService } from "../modules/notification/email-sender-config-service.ts";
import { ensureSeededRole } from "./test-role-helper.ts";

const TEST_PREFIX = `test-email-sender/${crypto.randomUUID()}`;

async function createAdminUser() {
    const passwordHash = await hashPassword("Test@sohoa2026");
    const [profile] = await db.insert(userProfiles).values({
        email: `${TEST_PREFIX}-admin@test.local`,
        fullName: "Email Sender Admin",
        passwordHash,
        active: true,
    }).returning();

    await db.insert(userRoles).values({ userId: profile.id, roleId: AuthRole.ADMIN });
    return profile;
}

Deno.test({
    name: "Email Sender Config Integration Tests",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    await ensureSeededRole(AuthRole.ADMIN, "Administrator");
    const admin = await createAdminUser();

    try {
        await t.step("Admin can read email sender status", async () => {
            const status = await EmailSenderConfigService.getPublic();
            assertExists(status);
            assertEquals(typeof status.configured, "boolean");
            assertEquals(status.smtp.port > 0, true);
        });

        await t.step("Upsert requires password on first create", async () => {
            await deleteEmailSenderConfig();
            try {
                await EmailSenderConfigService.upsert({
                    smtpProvider: "gmail",
                    smtpHost: "smtp.gmail.com",
                    fromEmail: "noreply@fsi.vn",
                }, admin.id);
                throw new Error("expected password required error");
            } catch (error) {
                assertEquals(error instanceof Error, true);
                assertEquals((error as Error).message, "Password is required when creating email sender config");
            }
        });

        await t.step("Admin can upsert sender config", async () => {
            await deleteEmailSenderConfig();
            const status = await EmailSenderConfigService.upsert({
                smtpProvider: "gmail",
                smtpHost: "smtp.gmail.com",
                smtpPort: 587,
                smtpSecure: false,
                fromEmail: "noreply@fsi.vn",
                fromName: "Sohoa",
                replyTo: "support@fsi.vn",
                password: "smtp-test-password",
            }, admin.id);

            assertEquals(status.sender?.fromEmail, "noreply@fsi.vn");
            assertEquals(status.sender?.fromName, "Sohoa");
            assertEquals(status.sender?.replyTo, "support@fsi.vn");
            assertEquals(status.sender?.hasPassword, true);
            assertEquals(status.smtp.host, "smtp.gmail.com");
        });

        await t.step("Upsert without password keeps existing password", async () => {
            const before = await EmailSenderConfigService.getPublic();
            assertEquals(before.sender?.hasPassword, true);

            const status = await EmailSenderConfigService.upsert({
                smtpProvider: "office365",
                smtpHost: "smtp.office365.com",
                fromEmail: "updated@fsi.vn",
                fromName: "Updated Name",
            }, admin.id);

            assertEquals(status.sender?.fromEmail, "updated@fsi.vn");
            assertEquals(status.sender?.fromName, "Updated Name");
            assertEquals(status.sender?.hasPassword, true);
            assertEquals(status.smtp.host, "smtp.office365.com");
        });

        await t.step("test-send rejects when email is not fully configured", async () => {
            await deleteEmailSenderConfig();
            try {
                await EmailSenderConfigService.testSend(undefined, admin.email);
                throw new Error("expected not configured error");
            } catch (error) {
                assertEquals(error instanceof Error, true);
                assertEquals(
                    (error as Error).message.includes("Email not configured: missing"),
                    true,
                );
            }
        });

    } finally {
        await deleteEmailSenderConfig();
        await db.delete(userRoles).where(eq(userRoles.userId, admin.id));
        await db.delete(userProfiles).where(eq(userProfiles.id, admin.id));
    }
});
