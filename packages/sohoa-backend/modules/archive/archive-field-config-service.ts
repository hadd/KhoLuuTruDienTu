import { asc, eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    ARCHIVE_PRESET_FIELD_KEY_SET,
    ArchiveFieldType,
    ArchiveReferenceSource,
} from "../../db/schemas/archive-constants.ts";
import { archiveFieldConfigs } from "../../db/schemas/archive-field-config.ts";

export type CreateArchiveFieldConfigInput = {
    fieldKey: string;
    label: string;
    fieldType: typeof ArchiveFieldType[keyof typeof ArchiveFieldType];
    referenceSource?: typeof ArchiveReferenceSource[keyof typeof ArchiveReferenceSource] | null;
    dependsOnFieldKey?: string | null;
    isRequired?: boolean;
    options?: Array<{ value: string; label: string }>;
    displayOrder?: number;
    isActive?: boolean;
};

export type UpdateArchiveFieldConfigInput = Partial<CreateArchiveFieldConfigInput>;

function validateFieldConfigShape(input: {
    fieldType: string;
    referenceSource?: string | null;
    options?: Array<{ value: string; label: string }>;
}) {
    if (input.fieldType === ArchiveFieldType.REFERENCE) {
        if (!input.referenceSource) {
            throw httpError.badRequest("Trường REFERENCE phải có referenceSource");
        }
        if (input.options && input.options.length > 0) {
            throw httpError.badRequest("Trường REFERENCE không được có options");
        }
        return;
    }

    if (input.referenceSource) {
        throw httpError.badRequest("Chỉ trường REFERENCE mới được có referenceSource");
    }

    if (input.fieldType === ArchiveFieldType.SELECT) {
        if (!input.options || input.options.length === 0) {
            throw httpError.badRequest("Trường SELECT phải có ít nhất một lựa chọn");
        }
    }
}

async function assertUniqueFieldKey(fieldKey: string, excludeId?: string) {
    const existing = await db.query.archiveFieldConfigs.findFirst({
        where: eq(archiveFieldConfigs.fieldKey, fieldKey),
        columns: { id: true },
    });
    if (existing && existing.id !== excludeId) {
        throw httpError.conflict(`fieldKey "${fieldKey}" đã tồn tại`);
    }
}

export const ArchiveFieldConfigService = {
    async listFieldConfigs(includeInactive = true) {
        const rows = await db
            .select()
            .from(archiveFieldConfigs)
            .orderBy(asc(archiveFieldConfigs.displayOrder), asc(archiveFieldConfigs.createdAt));

        if (includeInactive) {
            return rows;
        }
        return rows.filter((row) => row.isActive);
    },

    async listActiveFieldConfigs() {
        return ArchiveFieldConfigService.listFieldConfigs(false);
    },

    async getFieldConfig(id: string) {
        const row = await db.query.archiveFieldConfigs.findFirst({
            where: eq(archiveFieldConfigs.id, id),
        });
        if (!row) {
            throw httpError.notFound("Cấu hình trường lưu kho không tồn tại");
        }
        return row;
    },

    async createFieldConfig(input: CreateArchiveFieldConfigInput) {
        validateFieldConfigShape(input);
        await assertUniqueFieldKey(input.fieldKey);

        const [row] = await db
            .insert(archiveFieldConfigs)
            .values({
                fieldKey: input.fieldKey,
                label: input.label,
                fieldType: input.fieldType,
                referenceSource: input.fieldType === ArchiveFieldType.REFERENCE
                    ? input.referenceSource ?? null
                    : null,
                dependsOnFieldKey: input.dependsOnFieldKey ?? null,
                isRequired: input.isRequired ?? false,
                options: input.options ?? [],
                displayOrder: input.displayOrder ?? 0,
                isActive: input.isActive ?? true,
            })
            .returning();

        return row;
    },

    async updateFieldConfig(id: string, input: UpdateArchiveFieldConfigInput) {
        const current = await ArchiveFieldConfigService.getFieldConfig(id);
        const nextFieldType = input.fieldType ?? current.fieldType;
        const nextReferenceSource = input.referenceSource !== undefined
            ? input.referenceSource
            : current.referenceSource;
        const nextOptions = input.options !== undefined ? input.options : current.options;

        validateFieldConfigShape({
            fieldType: nextFieldType,
            referenceSource: nextReferenceSource,
            options: nextOptions,
        });

        if (input.fieldKey && input.fieldKey !== current.fieldKey) {
            await assertUniqueFieldKey(input.fieldKey, id);
        }

        const [row] = await db
            .update(archiveFieldConfigs)
            .set({
                ...(input.fieldKey !== undefined ? { fieldKey: input.fieldKey } : {}),
                ...(input.label !== undefined ? { label: input.label } : {}),
                ...(input.fieldType !== undefined ? { fieldType: input.fieldType } : {}),
                referenceSource: nextFieldType === ArchiveFieldType.REFERENCE
                    ? nextReferenceSource
                    : null,
                ...(input.dependsOnFieldKey !== undefined
                    ? { dependsOnFieldKey: input.dependsOnFieldKey }
                    : {}),
                ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
                ...(input.options !== undefined ? { options: input.options } : {}),
                ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
                ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
                updatedAt: new Date(),
            })
            .where(eq(archiveFieldConfigs.id, id))
            .returning();

        return row;
    },

    async deleteFieldConfig(id: string) {
        const current = await ArchiveFieldConfigService.getFieldConfig(id);

        if (ARCHIVE_PRESET_FIELD_KEY_SET.has(current.fieldKey)) {
            throw httpError.badRequest("Không thể xóa trường danh mục có sẵn");
        }

        await db.delete(archiveFieldConfigs).where(eq(archiveFieldConfigs.id, id));
        return current;
    },

    async reorderFields(ids: string[]) {
        const existing = await db.select({ id: archiveFieldConfigs.id }).from(archiveFieldConfigs);
        const existingIds = new Set(existing.map((row) => row.id));
        for (const id of ids) {
            if (!existingIds.has(id)) {
                throw httpError.badRequest(`Cấu hình trường ${id} không tồn tại`);
            }
        }

        await db.transaction(async (tx) => {
            for (let index = 0; index < ids.length; index++) {
                await tx
                    .update(archiveFieldConfigs)
                    .set({ displayOrder: index, updatedAt: new Date() })
                    .where(eq(archiveFieldConfigs.id, ids[index]));
            }
        });

        return ArchiveFieldConfigService.listFieldConfigs();
    },
};
