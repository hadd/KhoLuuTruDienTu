export const ProjectStatus = {
    IN_PROGRESS: "IN_PROGRESS",
    EXTENDED: "EXTENDED",
    ACCEPTED: "ACCEPTED",
    SUSPENDED: "SUSPENDED",
    CANCELLED: "CANCELLED",
} as const;

export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];

export const PROJECT_STATUS_VALUES = Object.values(ProjectStatus);
