export const SmtpProvider = {
    GMAIL: "gmail",
    OUTLOOK: "outlook",
    OFFICE365: "office365",
    CUSTOM: "custom",
} as const;

export type SmtpProviderValue = typeof SmtpProvider[keyof typeof SmtpProvider];

export type SmtpPreset = {
    host: string;
    port: number;
    secure: boolean;
};

export const SMTP_PRESETS: Record<Exclude<SmtpProviderValue, "custom">, SmtpPreset> = {
    [SmtpProvider.GMAIL]: {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
    },
    [SmtpProvider.OUTLOOK]: {
        host: "smtp-mail.outlook.com",
        port: 587,
        secure: false,
    },
    [SmtpProvider.OFFICE365]: {
        host: "smtp.office365.com",
        port: 587,
        secure: false,
    },
};

export function inferSmtpProvider(host: string | null | undefined): SmtpProviderValue {
    const normalized = host?.trim().toLowerCase() ?? "";
    if (normalized === SMTP_PRESETS.gmail.host) return SmtpProvider.GMAIL;
    if (normalized === SMTP_PRESETS.outlook.host) return SmtpProvider.OUTLOOK;
    if (normalized === SMTP_PRESETS.office365.host) return SmtpProvider.OFFICE365;
    return SmtpProvider.CUSTOM;
}

export function resolveSmtpPreset(
    provider: SmtpProviderValue,
    custom?: { host: string; port: number; secure: boolean },
): SmtpPreset {
    if (provider === SmtpProvider.CUSTOM) {
        if (!custom?.host?.trim()) {
            throw new Error("SMTP host is required for custom provider");
        }
        return {
            host: custom.host.trim(),
            port: custom.port,
            secure: custom.secure,
        };
    }
    return SMTP_PRESETS[provider];
}
