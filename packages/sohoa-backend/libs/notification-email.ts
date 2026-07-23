import {
    formatEmailFrom,
    getResolvedEmailConfig,
    isEmailConfigured,
} from "./email-config.ts";

export type EmailMessage = {
    to: string;
    subject: string;
    text: string;
};

export { isEmailConfigured };

export async function sendNotificationEmail(message: EmailMessage): Promise<void> {
    const config = await getResolvedEmailConfig();

    const nodemailer = await import("npm:nodemailer@^6.9.0");
    const transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.authUser,
            pass: config.smtpPassword,
        },
    });

    await transport.sendMail({
        from: formatEmailFrom({
            fromEmail: config.fromEmail,
            fromName: config.fromName,
        }),
        to: message.to,
        replyTo: config.replyTo ?? undefined,
        subject: message.subject,
        text: message.text,
    });
}
