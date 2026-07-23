import { httpError } from "@shared/common-lib";
import { eq } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { emailSenderConfigs } from "../../db/schemas/email-sender-config.ts";
import { encryptPassword } from "../../libs/email-crypto.ts";
import {
    getEmailConfigStatus,
    isEmailConfigured,
    type EmailConfigStatus,
} from "../../libs/email-config.ts";
import { sendNotificationEmail } from "../../libs/notification-email.ts";
import {
    inferSmtpProvider,
    resolveSmtpPreset,
    SmtpProvider,
    type SmtpProviderValue,
} from "./smtp-presets.ts";
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
    if (input.smtpUser) {
        validateEmailField(input.smtpUser, "smtpUser");
    }
    if (input.password !== undefined && input.password.trim() === "") {
        throw httpError.badRequest("Password cannot be empty when provided");
    }
    if (input.smtpPort !== undefined && (input.smtpPort < 1 || input.smtpPort > 65535)) {
        throw httpError.badRequest("Invalid smtpPort");
    }
}

function resolveSmtpFields(input: EmailSenderUpsertInput) {
    const provider = (input.smtpProvider ?? SmtpProvider.CUSTOM) as SmtpProviderValue;
    const preset = resolveSmtpPreset(provider, {
        host: input.smtpHost ?? "",
        port: input.smtpPort ?? 587,
        secure: input.smtpSecure ?? false,
    });

    return {
        smtpHost: preset.host,
        smtpPort: input.smtpPort ?? preset.port,
        smtpSecure: input.smtpSecure ?? preset.secure,
    };
}

export const EmailSenderConfigService = {
    async getPublic(): Promise<EmailConfigStatus & { smtpProvider: SmtpProviderValue }> {
        const status = await getEmailConfigStatus();
        return {
            ...status,
            smtpProvider: inferSmtpProvider(status.smtp.host),
        };
    },

    async upsert(input: EmailSenderUpsertInput, actorId: string): Promise<EmailConfigStatus> {
        validateUpsertInput(input);

        const existing = await db.query.emailSenderConfigs.findFirst();
        const smtpFields = resolveSmtpFields(input);

        let smtpPasswordEncrypted: string;
        if (input.password !== undefined) {
            smtpPasswordEncrypted = await encryptPassword(input.password);
        } else if (existing) {
            smtpPasswordEncrypted = existing.smtpPasswordEncrypted;
        } else {
            throw httpError.badRequest("Password is required when creating email sender config");
        }

        const values = {
            smtpHost: smtpFields.smtpHost,
            smtpPort: smtpFields.smtpPort,
            smtpSecure: smtpFields.smtpSecure,
            smtpUser: input.smtpUser?.trim() || null,
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
