import { httpError } from "@shared/common-lib";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { metadataExportPresets } from "../../db/schemas/metadata_export_preset.ts";
import {
    parseExportColumns,
    serializeExportColumns,
    validateExportColumns,
    validateExportColumnsForExport,
    type MetadataExportColumnConfig,
    type MetadataExportConfig,
} from "../../libs/metadata-export-types.ts";

function mapPreset(row: {
    id: string;
    name: string;
    description: string | null;
    columns: string;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        columns: parseExportColumns(row.columns),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export const MetadataExportPresetService = {
    async list() {
        const rows = await db.query.metadataExportPresets.findMany({
            where: isNull(metadataExportPresets.deletedAt),
            orderBy: desc(metadataExportPresets.updatedAt),
        });
        return rows.map(mapPreset);
    },

    async get(id: string) {
        const row = await db.query.metadataExportPresets.findFirst({
            where: and(
                eq(metadataExportPresets.id, id),
                isNull(metadataExportPresets.deletedAt),
            ),
        });
        if (!row) {
            throw httpError.notFound("Metadata export preset not found");
        }
        return mapPreset(row);
    },

    async create(input: {
        name: string;
        description?: string | null;
        columns: MetadataExportColumnConfig[];
    }) {
        validateExportColumns(input.columns);
        const [row] = await db.insert(metadataExportPresets).values({
            name: input.name.trim(),
            description: input.description?.trim() || null,
            columns: serializeExportColumns(input.columns),
        }).returning();
        return mapPreset(row);
    },

    async update(
        id: string,
        input: {
            name: string;
            description?: string | null;
            columns: MetadataExportColumnConfig[];
        },
    ) {
        validateExportColumns(input.columns);
        const [row] = await db.update(metadataExportPresets)
            .set({
                name: input.name.trim(),
                description: input.description?.trim() || null,
                columns: serializeExportColumns(input.columns),
                updatedAt: new Date(),
            })
            .where(and(
                eq(metadataExportPresets.id, id),
                isNull(metadataExportPresets.deletedAt),
            ))
            .returning();
        if (!row) {
            throw httpError.notFound("Metadata export preset not found");
        }
        return mapPreset(row);
    },

    async remove(id: string) {
        const [row] = await db.update(metadataExportPresets)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(and(
                eq(metadataExportPresets.id, id),
                isNull(metadataExportPresets.deletedAt),
            ))
            .returning({ id: metadataExportPresets.id });
        if (!row) {
            throw httpError.notFound("Metadata export preset not found");
        }
        return { success: true };
    },

    async resolveExportConfig(input: {
        presetId?: string;
        columns?: MetadataExportColumnConfig[];
    }): Promise<MetadataExportConfig> {
        if (input.presetId) {
            const preset = await this.get(input.presetId);
            validateExportColumnsForExport(preset.columns);
            return { columns: preset.columns };
        }
        if (input.columns) {
            validateExportColumnsForExport(input.columns);
            return { columns: input.columns };
        }
        throw httpError.badRequest("Export requires presetId or columns");
    },
};
