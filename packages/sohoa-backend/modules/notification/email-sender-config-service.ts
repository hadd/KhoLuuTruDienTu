import { httpError } from "@shared/common-lib";
import { eq } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import {
    EMAIL_SENDER_CONFIG_DEFAULT_KEY,
    emailSenderConfigs,
} from "../../db/schemas/email-sender-config.ts";
import { encryptPassword } from "../../libs/email-crypto.ts";
import {
    getEmailConfigStatus,
    isEmailConfigured,
    type EmailConfigStatus,
} from "../../libs/email-config.ts";
import { sendNotificationEmail } from "../../libs/notification-email.ts";
import type { EmailSenderUpsertInput } from "./types.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmailField(value: string, fieldName: string) {
    if (!EMAIL_PATTERN.test(value.trim())) {
        throw httpError.badRequest(`Invalid ${fieldName}: ${value}`);
    }
}

function validateUpsertInput(input: EmailSenderUpsertInput) {
    validateEmailField(input.fromEmail, "fromEmail");
    if (input.replyTo) {
        validateEmailField(input.replyTo, "replyTo");
    }
    if (input.password !== undefined && input.password.trim() === "") {
        throw httpError.badRequest("Password cannot be empty when provided");
    }
}

export const EmailSenderConfigService = {
    async getPublic(): Promise<EmailConfigStatus> {
        return await getEmailConfigStatus();
    },

    async upsert(input: EmailSenderUpsertInput, actorId: string): Promise<EmailConfigStatus> {
        validateUpsertInput(input);

        const existing = await db.query.emailSenderConfigs.findFirst({
            where: eq(emailSenderConfigs.key, EMAIL_SENDER_CONFIG_DEFAULT_KEY),
        });

        let smtpPasswordEncrypted: string;
        if (input.password !== undefined) {
            smtpPasswordEncrypted = await encryptPassword(input.password);
        } else if (existing) {
            smtpPasswordEncrypted = existing.smtpPasswordEncrypted;
        } else {
            throw httpError.badRequest("Password is required when creating email sender config");
        }

        const values = {
            key: EMAIL_SENDER_CONFIG_DEFAULT_KEY,
            fromEmail: input.fromEmail.trim(),
            fromName: input.fromName?.trim() || null,
            replyTo: input.replyTo?.trim() || null,
            smtpPasswordEncrypted,
            updatedById: actorId,
            updatedAt: new Date(),
        };

        if (existing) {
            await db.update(emailSenderConfigs)
                .set(values)
                .where(eq(emailSenderConfigs.id, existing.id));
        } else {
            await db.insert(emailSenderConfigs).values(values);
        }

        return await getEmailConfigStatus();
    },

    async testSend(to: string | undefined, fallbackTo: string): Promise<{ sentTo: string }> {
        const recipient = to?.trim() || fallbackTo?.trim();
        if (!recipient) {
            throw httpError.badRequest("Recipient email is required");
        }
        validateEmailField(recipient, "to");

        if (!await isEmailConfigured()) {
            const status = await getEmailConfigStatus();
            throw httpError.badRequest(
                `Email not configured: missing ${status.missingFields.join(", ")}`,
            );
        }

        await sendNotificationEmail({
            to: recipient,
            subject: "Sohoa test email",
            text: "This is a test email from Sohoa notification settings.",
        });

        return { sentTo: recipient };
    },
};
