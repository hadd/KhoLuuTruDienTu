import { schema } from "./schema-helper.ts";

export const entityTypeEnum = schema.enum("entity_type", ["DOSSIER", "DOCUMENT"]);

export const dossierStatusEnum = schema.enum("dossier_status", [
    "NEW",
    "OCR_PROCESSING",
    "OCR_FAILED",
    "READY_FOR_ENTRY",
    "ENTRY_PROCESSING",
    "WAITING_CHECKER_1",
    "CHECKER_1_PROCESSING",
    "CHECKER_1_REJECTED",
    "WAITING_CHECKER_2",
    "CHECKER_2_PROCESSING",
    "CHECKER_2_REJECTED",
    "APPROVED",
]);

export const workerRoleEnum = schema.enum("worker_role", ["MAKER", "CHECKER_1", "CHECKER_2"]);

export const assignmentStatusEnum = schema.enum("assignment_status", [
    "IN_PROGRESS",
    "COMPLETED",
    "REJECTED",
]);
