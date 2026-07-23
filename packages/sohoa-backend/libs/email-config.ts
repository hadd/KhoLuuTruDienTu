import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { emailSenderConfigs } from "../db/schemas/email-sender-config.ts";
import { env } from "../env.ts";
import { decryptPassword } from "./email-crypto.ts";

export type EmailConfigStatus = {
    configured: boolean;
    missingFields: string[];
    smtp: {
        host: string | null;
        port: number;
        secure: boolean;
        user: string | null;
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
    authUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string | null;
    replyTo: string | null;
};

async function loadSenderRow() {
    return await db.query.emailSenderConfigs.findFirst();
}

function resolveSmtpFromRow(row: typeof emailSenderConfigs.$inferSelect | undefined) {
    const host = row?.smtpHost?.trim() || env.SMTP_HOST?.trim() || "";
    const port = row?.smtpPort ?? env.SMTP_PORT;
    const secure = row?.smtpSecure ?? env.SMTP_SECURE;
    return { host, port, secure };
}

function buildSenderStatus(row: typeof emailSenderConfigs.$inferSelect | undefined): EmailConfigStatus {
    const smtp = resolveSmtpFromRow(row);
    const missingFields: string[] = [];

    if (!smtp.host) {
        missingFields.push("smtpHost");
    }

    if (!row) {
        return {
            configured: false,
            missingFields: [...missingFields, "fromEmail", "smtpPassword"],
            smtp: {
                host: smtp.host || null,
                port: smtp.port,
                secure: smtp.secure,
                user: null,
            },
            sender: null,
        };
    }

    const hasPassword = Boolean(row.smtpPasswordEncrypted?.trim());
    if (!row.fromEmail?.trim()) {
        missingFields.push("fromEmail");
    }
    if (!hasPassword) {
        missingFields.push("smtpPassword");
    }

    const authUser = row.smtpUser?.trim() || row.fromEmail?.trim() || "";

    return {
        configured: missingFields.length === 0,
        missingFields,
        smtp: {
            host: smtp.host || null,
            port: smtp.port,
            secure: smtp.secure,
            user: authUser || null,
        },
        sender: {
            fromEmail: row.fromEmail,
            fromName: row.fromName,
            replyTo: row.replyTo,
            hasPassword,
        },
    };
}

export async function getEmailConfigStatus(): Promise<EmailConfigStatus> {
    return buildSenderStatus(await loadSenderRow());
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

    const smtp = resolveSmtpFromRow(row);
    const authUser = row.smtpUser?.trim() || row.fromEmail.trim();

    return {
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        authUser,
        smtpPassword: await decryptPassword(row.smtpPasswordEncrypted),
        fromEmail: row.fromEmail,
        fromName: row.fromName,
        replyTo: row.replyTo,
    };
}

export async function deleteEmailSenderConfig(): Promise<void> {
    const rows = await db.select({ id: emailSenderConfigs.id }).from(emailSenderConfigs);
    if (rows.length === 0) {
        return;
    }
    await db.delete(emailSenderConfigs).where(eq(emailSenderConfigs.id, rows[0].id));
}
