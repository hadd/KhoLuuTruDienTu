import { eq } from "drizzle-orm";
import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { documentTypes } from "../../db/schemas/document-type.ts";
import { retentionPeriods } from "../../db/schemas/retention-period.ts";
import {
    createDocumentTypeSchema,
    type CreateDocumentTypeInput,
    documentTypeEntitySchema,
    type UpdateDocumentTypeInput,
    updateDocumentTypeSchema,
} from "./types.ts";

async function assertRetentionPeriodExists(
    retentionPeriodId: string | null | undefined,
): Promise<string | null> {
    if (retentionPeriodId == null || retentionPeriodId.trim() === "") {
        return null;
    }
    const id = retentionPeriodId.trim();
    const [row] = await db
        .select({ id: retentionPeriods.id })
        .from(retentionPeriods)
        .where(eq(retentionPeriods.id, id))
        .limit(1);
    if (!row) {
        throw httpError.badRequest(`Không tìm thấy thời hạn lưu trữ: ${id}`);
    }
    return id;
}

const crud = createCrudService({
    db,
    table: documentTypes,
    searchable: ["id", "name", "description"],
    entitySchema: documentTypeEntitySchema,
    createSchema: createDocumentTypeSchema,
    updateSchema: updateDocumentTypeSchema,
    metadata: {
        tags: ["DocumentType"],
        descriptions: {
            list: "List document types with pagination, filtering and search.",
            get: "Get a document type by ID.",
            create: "Create a document type record.",
            update: "Update a document type record (cannot update ID).",
            delete: "Delete a document type record.",
        },
    },
});

export const DocumentTypeService = {
    ...crud,
    async create(input: CreateDocumentTypeInput) {
        const retentionPeriodId = await assertRetentionPeriodExists(
            input.retentionPeriodId,
        );
        return crud.create({
            id: input.id,
            name: input.name,
            description: input.description ?? "",
            retentionPeriodId,
        });
    },
    async update(id: string, input: UpdateDocumentTypeInput) {
        const payload: Record<string, unknown> = {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined
                ? { description: input.description }
                : {}),
            updatedAt: new Date(),
        };
        if (input.retentionPeriodId !== undefined) {
            payload.retentionPeriodId = await assertRetentionPeriodExists(
                input.retentionPeriodId,
            );
        }
        return crud.update(id, payload);
    },
};
