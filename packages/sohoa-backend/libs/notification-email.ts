import { env } from "../env.ts";

export type EmailMessage = {
    to: string;
    subject: string;
    text: string;
};

export function isEmailConfigured(): boolean {
    return Boolean(
        env.SMTP_HOST
            && env.SMTP_USER
            && env.SMTP_PASSWORD
            && env.SMTP_FROM,
    );
}

export async function sendNotificationEmail(message: EmailMessage): Promise<void> {
    if (!isEmailConfigured()) {
        throw new Error(
            "SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM required)",
        );
    }

    const nodemailer = await import("npm:nodemailer@^6.9.0");
    const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASSWORD,
        },
    });

    await transport.sendMail({
        from: env.SMTP_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
    });
}
