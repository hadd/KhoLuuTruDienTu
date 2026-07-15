import { t } from "elysia";

export const NotificationType = {
    OCR_COMPLETED: "OCR_COMPLETED",
    DOSSIER_ASSIGNED: "DOSSIER_ASSIGNED",
    EDITORS_COMPLETED: "EDITORS_COMPLETED",
    QC_STEP_COMPLETED: "QC_STEP_COMPLETED",
    DOSSIER_APPROVED: "DOSSIER_APPROVED",
} as const;

export const NOTIFICATION_TYPE_VALUES = [
    NotificationType.OCR_COMPLETED,
    NotificationType.DOSSIER_ASSIGNED,
    NotificationType.EDITORS_COMPLETED,
    NotificationType.QC_STEP_COMPLETED,
    NotificationType.DOSSIER_APPROVED,
] as const;

export type NotificationTypeValue = typeof NOTIFICATION_TYPE_VALUES[number];

export const NotificationChannel = {
    SYSTEM: "system",
    EMAIL: "email",
} as const;

export const NOTIFICATION_CHANNEL_VALUES = [
    NotificationChannel.SYSTEM,
    NotificationChannel.EMAIL,
] as const;

export type NotificationChannelValue = typeof NOTIFICATION_CHANNEL_VALUES[number];

export const NotificationDeliveryStatus = {
    PENDING: "pending",
    SENT: "sent",
    FAILED: "failed",
} as const;

export const NOTIFICATION_DELIVERY_STATUS_VALUES = [
    NotificationDeliveryStatus.PENDING,
    NotificationDeliveryStatus.SENT,
    NotificationDeliveryStatus.FAILED,
] as const;

export const notificationTypeSchema = t.Union([
    t.Literal(NotificationType.OCR_COMPLETED),
    t.Literal(NotificationType.DOSSIER_ASSIGNED),
    t.Literal(NotificationType.EDITORS_COMPLETED),
    t.Literal(NotificationType.QC_STEP_COMPLETED),
    t.Literal(NotificationType.DOSSIER_APPROVED),
]);

export const notificationChannelSchema = t.Union([
    t.Literal(NotificationChannel.SYSTEM),
    t.Literal(NotificationChannel.EMAIL),
]);
