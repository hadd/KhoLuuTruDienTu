import type {
    NotificationChannelValue,
    NotificationTypeValue,
} from "../../db/schemas/notification-constants.ts";
import type { EmailConfigStatus } from "../../libs/email-config.ts";

export type EmailSenderStatus = EmailConfigStatus;

export type EmailSenderUpsertInput = {
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
    dedupeKey: string;
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
    entityType: string | null;
    entityId: string | null;
    actionUrl: string;
    payload: unknown;
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

export type SecurityLevelChangeAction = "created" | "updated" | "deleted" | "status_changed";

export type SecurityLevelChangedNotificationContext = {
    securityLevelId: string;
    securityLevelName: string;
    actorId: string;
    action: SecurityLevelChangeAction;
    isActive?: boolean;
};

export type WorkflowNotificationContext =
    | OcrCompletedNotificationContext
    | DossierAssignedNotificationContext
    | EditorsCompletedNotificationContext
    | QcStepCompletedNotificationContext
    | DossierApprovedNotificationContext
    | SecurityLevelChangedNotificationContext;

export type NotificationDispatchContext = WorkflowNotificationContext;

export type NotificationRealtimePayload = {
    id: string;
    type: string;
    title: string;
    body: string;
    actionUrl: string;
    entityType: string | null;
    entityId: string | null;
    createdAt: string;
};
