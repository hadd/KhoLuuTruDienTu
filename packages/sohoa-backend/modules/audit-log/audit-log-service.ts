import { createCrudService } from "@shared/base-crud";
import { db } from "../../db/db-conn.ts";
import { apiAuditLogs, apiAuditLogEntitySchema } from "../../db/schemas/api-audit-log.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";

const crud = createCrudService({
    db,
    table: apiAuditLogs,
    searchable: ["path", "action", "method"],
    entitySchema: apiAuditLogEntitySchema,
    relationTables: {
        user: userProfiles,
    },
    defaultWith: {
        user: true,
    },
    metadata: {
        tags: ["Admin", "Audit Log"],
        descriptions: {
            list: "List API audit logs with pagination, filtering and search. Filter by userId, createdAt, path, action, method. Admin role required.",
            get: "Get an API audit log by ID. Admin role required.",
        },
    },
});

export const AuditLogService = {
    ...crud,
};
