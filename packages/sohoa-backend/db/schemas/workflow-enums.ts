import {
    ASSIGNMENT_STATUS_VALUES,
    DOSSIER_STATUS_VALUES,
    ENTITY_TYPE_VALUES,
    WORKER_ROLE_VALUES,
} from "./workflow-constants.ts";
import { schema } from "./schema-helper.ts";

export const entityTypeEnum = schema.enum("entity_type", ENTITY_TYPE_VALUES);

export const dossierStatusEnum = schema.enum("dossier_status", DOSSIER_STATUS_VALUES);

export const workerRoleEnum = schema.enum("worker_role", WORKER_ROLE_VALUES);

export const assignmentStatusEnum = schema.enum("assignment_status", ASSIGNMENT_STATUS_VALUES);
