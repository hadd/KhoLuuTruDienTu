import type {
    NotificationChannelValue,
    NotificationTypeValue,
} from "../../db/schemas/notification-constants.ts";
import type { EmailConfigStatus } from "../../libs/email-config.ts";
import type { SmtpProviderValue } from "./smtp-presets.ts";

export type EmailSenderStatus = EmailConfigStatus & {
    smtpProvider: SmtpProviderValue;
};

export type EmailSenderUpsertInput = {
    smtpProvider?: SmtpProviderValue;
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string | null;
    fromEmail: string;
    fromName?: string | null;
    replyTo?: string | null;
    password?: string;
};

export type NotificationConfigInput = {
    notificationType: NotificationTypeValue;
    channels: NotificationChannelValue[];
    roleIds: string[];
    active?: boolean;
};

export type NotificationConfigRecord = {
    id: string;
    notificationType: NotificationTypeValue;
    channels: NotificationChannelValue[];
    roleIds: string[];
    active: boolean;
    createdById: string | null;
    updatedById: string | null;
    createdAt: Date;
    updatedAt: Date;
    warnings?: string[];
};

export type NotificationInboxRecord = {
    id: string;
    type: string;
    title: string;
    body: string;
    actionUrl: string;
    readAt: Date | null;
    createdAt: Date;
};

export type OcrCompletedNotificationContext = {
    dossierId: string;
    folderId: string;
    folderPath: string;
    dossierName: string;
};

export type DossierAssignedNotificationContext = {
    dossierId: string;
    assigneeId: string;
    workerRole: string;
    dossierName: string;
    folderId: string;
};

export type EditorsCompletedNotificationContext = {
    dossierId: string;
    assigneeId: string;
    workerRole: string;
    dossierName: string;
    folderId: string;
    qcStep: number;
};

export type QcStepCompletedNotificationContext = {
    dossierId: string;
    assigneeId: string;
    workerRole: string;
    dossierName: string;
    folderId: string;
    completedQcStep: number;
    nextQcStep: number;
};

export type DossierApprovedNotificationContext = {
    dossierId: string;
    managerId: string;
    dossierName: string;
    folderId: string;
};

export type WorkflowNotificationContext =
    | OcrCompletedNotificationContext
    | DossierAssignedNotificationContext
    | EditorsCompletedNotificationContext
    | QcStepCompletedNotificationContext
    | DossierApprovedNotificationContext;

export type NotificationRealtimePayload = {
    id: string;
    type: string;
    title: string;
    body: string;
    actionUrl: string;
    createdAt: string;
};
