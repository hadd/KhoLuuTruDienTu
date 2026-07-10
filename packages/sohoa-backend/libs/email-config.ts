import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import {
    EMAIL_SENDER_CONFIG_DEFAULT_KEY,
    emailSenderConfigs,
} from "../db/schemas/email-sender-config.ts";
import { env } from "../env.ts";
import { decryptPassword } from "./email-crypto.ts";

export type EmailConfigStatus = {
    configured: boolean;
    infraReady: boolean;
    senderReady: boolean;
    missingFields: string[];
    infra: {
        hostConfigured: boolean;
        port: number;
        secure: boolean;
    };
    sender: {
        fromEmail: string;
        fromName: string | null;
        replyTo: string | null;
        hasPassword: boolean;
    } | null;
};

export type ResolvedEmailConfig = {
    host: string;
    port: number;
    secure: boolean;
    fromEmail: string;
    fromName: string | null;
    replyTo: string | null;
    smtpPassword: string;
};

function getInfraStatus() {
    const hostConfigured = Boolean(env.SMTP_HOST?.trim());
    return {
        hostConfigured,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        infraReady: hostConfigured,
        missingFields: hostConfigured ? [] : ["SMTP_HOST"],
    };
}

async function loadSenderRow() {
    return await db.query.emailSenderConfigs.findFirst({
        where: eq(emailSenderConfigs.key, EMAIL_SENDER_CONFIG_DEFAULT_KEY),
    });
}

function buildSenderStatus(row: typeof emailSenderConfigs.$inferSelect | undefined) {
    if (!row) {
        return {
            sender: null,
            senderReady: false,
            missingFields: ["fromEmail", "smtpPassword"],
        };
    }

    const hasPassword = Boolean(row.smtpPasswordEncrypted?.trim());
    const missingFields: string[] = [];
    if (!row.fromEmail?.trim()) {
        missingFields.push("fromEmail");
    }
    if (!hasPassword) {
        missingFields.push("smtpPassword");
    }

    return {
        sender: {
            fromEmail: row.fromEmail,
            fromName: row.fromName,
            replyTo: row.replyTo,
            hasPassword,
        },
        senderReady: missingFields.length === 0,
        missingFields,
    };
}

export async function getEmailConfigStatus(): Promise<EmailConfigStatus> {
    const infra = getInfraStatus();
    const senderStatus = buildSenderStatus(await loadSenderRow());
    const missingFields = [...infra.missingFields, ...senderStatus.missingFields];

    return {
        configured: infra.infraReady && senderStatus.senderReady,
        infraReady: infra.infraReady,
        senderReady: senderStatus.senderReady,
        missingFields,
        infra: {
            hostConfigured: infra.hostConfigured,
            port: infra.port,
            secure: infra.secure,
        },
        sender: senderStatus.sender,
    };
}

export async function isEmailConfigured(): Promise<boolean> {
    const status = await getEmailConfigStatus();
    return status.configured;
}

export function formatEmailFrom(input: { fromEmail: string; fromName: string | null }): string {
    if (input.fromName?.trim()) {
        const escapedName = input.fromName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return `"${escapedName}" <${input.fromEmail}>`;
    }
    return input.fromEmail;
}

export async function getResolvedEmailConfig(): Promise<ResolvedEmailConfig> {
    const status = await getEmailConfigStatus();
    if (!status.configured) {
        throw new Error(`Email not configured: missing ${status.missingFields.join(", ")}`);
    }

    const row = await loadSenderRow();
    if (!row) {
        throw new Error("Email not configured: missing fromEmail, smtpPassword");
    }

    return {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        fromEmail: row.fromEmail,
        fromName: row.fromName,
        replyTo: row.replyTo,
        smtpPassword: await decryptPassword(row.smtpPasswordEncrypted),
    };
}
