import { count, eq, inArray } from "drizzle-orm";
import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { documentTypes } from "../../db/schemas/document-type.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
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

async function countFilesUsingDocumentType(documentTypeId: string): Promise<number> {
    const [row] = await db
        .select({ value: count() })
        .from(dossierFiles)
        .where(eq(dossierFiles.documentTypeId, documentTypeId));
    return row?.value ?? 0;
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
            delete:
                "Delete a document type only when unused by any file; otherwise deactivate.",
        },
    },
});

export const DocumentTypeService = {
    ...crud,
    async listActive() {
        const items = await db
            .select()
            .from(documentTypes)
            .where(eq(documentTypes.isActive, true))
            .orderBy(documentTypes.name);
        return { items };
    },
    async list(input: Parameters<typeof crud.list>[0]) {
        const result = await crud.list(input);
        const ids = result.items.map((item) => item.id);
        if (ids.length === 0) {
            return {
                ...result,
                items: result.items.map((item) => ({
                    ...item,
                    fileCount: 0,
                    inUse: false,
                })),
            };
        }

        const usageRows = await db
            .select({
                documentTypeId: dossierFiles.documentTypeId,
                fileCount: count(),
            })
            .from(dossierFiles)
            .where(inArray(dossierFiles.documentTypeId, ids))
            .groupBy(dossierFiles.documentTypeId);

        const usageById = new Map(
            usageRows
                .filter((row): row is typeof row & { documentTypeId: string } =>
                    Boolean(row.documentTypeId)
                )
                .map((row) => [row.documentTypeId, Number(row.fileCount) || 0]),
        );

        return {
            ...result,
            items: result.items.map((item) => {
                const fileCount = usageById.get(item.id) ?? 0;
                return {
                    ...item,
                    fileCount,
                    inUse: fileCount > 0,
                };
            }),
        };
    },
    async create(input: CreateDocumentTypeInput) {
        const retentionPeriodId = await assertRetentionPeriodExists(
            input.retentionPeriodId,
        );
        return crud.create({
            id: input.id,
            name: input.name,
            description: input.description ?? "",
            retentionPeriodId,
            isActive: input.isActive ?? true,
        });
    },
    async update(id: string, input: UpdateDocumentTypeInput) {
        const payload: Record<string, unknown> = {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined
                ? { description: input.description }
                : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            updatedAt: new Date(),
        };
        if (input.retentionPeriodId !== undefined) {
            payload.retentionPeriodId = await assertRetentionPeriodExists(
                input.retentionPeriodId,
            );
        }
        return crud.update(id, payload);
    },
    async delete(id: string) {
        const fileCount = await countFilesUsingDocumentType(id);
        if (fileCount > 0) {
            throw httpError.conflict(
                "Không thể xóa loại tài liệu đang được sử dụng bởi ít nhất một văn bản. Hãy vô hiệu hóa thay vì xóa.",
            );
        }
        return crud.delete(id);
    },
};
