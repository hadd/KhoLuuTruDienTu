import { httpError } from "@shared/common-lib";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { metadataPermissionConfigs } from "../../db/schemas/metadata_permission_config.ts";
import { metadataTemplates } from "../../db/schemas/metadata_template.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { downloadJsonFromStorage } from "../data-entry/data-entry-s3-utils.ts";
import {
    enrichFieldCatalogWithGroupNames,
    extractFieldCatalog,
    parseFieldCatalog,
    serializeFieldCatalog,
} from "../../libs/metadata-template.ts";
import { isDossierMetadata } from "../../libs/metadata-types.ts";

async function loadOcrMetadata(ocrMetadataKey: string) {
    const jsonKey = ocrMetadataKey.endsWith(".json")
        ? ocrMetadataKey
        : `${ocrMetadataKey}.json`;
    const raw = await downloadJsonFromStorage(jsonKey);
    return isDossierMetadata(raw) ? raw : null;
}

function fieldCatalogNeedsGroupName(catalog: ReturnType<typeof parseFieldCatalog>) {
    return catalog.some((entry) => !entry.groupName);
}

const OCR_READY_STATUSES = [
    DossierStatus.READY_FOR_ENTRY,
    DossierStatus.ENTRY_PROCESSING,
    DossierStatus.WAITING_CHECKER_1,
    DossierStatus.WAITING_CHECKER_2,
    DossierStatus.WAITING_CHECKER_3,
    DossierStatus.WAITING_CHECKER_4,
    DossierStatus.WAITING_CHECKER_5,
    DossierStatus.CHECKER_1_PROCESSING,
    DossierStatus.CHECKER_2_PROCESSING,
    DossierStatus.CHECKER_3_PROCESSING,
    DossierStatus.CHECKER_4_PROCESSING,
    DossierStatus.CHECKER_5_PROCESSING,
    DossierStatus.APPROVED,
    DossierStatus.CHECKER_1_REJECTED,
    DossierStatus.CHECKER_2_REJECTED,
    DossierStatus.CHECKER_3_REJECTED,
    DossierStatus.CHECKER_4_REJECTED,
    DossierStatus.CHECKER_5_REJECTED,
    DossierStatus.WAITING_ISSUE_RESOLUTION,
] as const;

function mapTemplate(row: {
    id: string;
    name: string;
    description: string | null;
    sourceDossierId: string;
    sourceOcrMetadataKey: string;
    fieldCatalog: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        sourceDossierId: row.sourceDossierId,
        sourceOcrMetadataKey: row.sourceOcrMetadataKey,
        fieldCatalog: parseFieldCatalog(row.fieldCatalog),
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export const MetadataTemplateService = {
    async listDossierOptions() {
        const rows = await db.query.dossiers.findMany({
            where: activeDossierWhere(
                isNotNull(dossiers.ocrMetadataKey),
                inArray(dossiers.status, [...OCR_READY_STATUSES]),
            ),
            columns: {
                id: true,
                name: true,
                folderPath: true,
                status: true,
                ocrMetadataKey: true,
            },
            orderBy: [desc(dossiers.updatedAt)],
            limit: 200,
        });

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            folderPath: row.folderPath,
            status: row.status,
            ocrMetadataKey: row.ocrMetadataKey,
        }));
    },

    async list() {
        const rows = await db.query.metadataTemplates.findMany({
            where: isNull(metadataTemplates.deletedAt),
            orderBy: [desc(metadataTemplates.updatedAt)],
        });
        return rows.map(mapTemplate);
    },

    async get(id: string) {
        const row = await db.query.metadataTemplates.findFirst({
            where: and(
                eq(metadataTemplates.id, id),
                isNull(metadataTemplates.deletedAt),
            ),
            with: {
                sourceDossier: {
                    columns: { id: true, name: true, folderPath: true, ocrMetadataKey: true },
                },
            },
        });
        if (!row) {
            throw httpError.notFound("Metadata template not found");
        }

        let fieldCatalog = parseFieldCatalog(row.fieldCatalog);
        if (
            fieldCatalogNeedsGroupName(fieldCatalog) &&
            row.sourceDossier?.ocrMetadataKey
        ) {
            const metadata = await loadOcrMetadata(row.sourceDossier.ocrMetadataKey);
            if (metadata) {
                fieldCatalog = enrichFieldCatalogWithGroupNames(fieldCatalog, metadata);
            }
        }

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            sourceDossierId: row.sourceDossierId,
            sourceOcrMetadataKey: row.sourceOcrMetadataKey,
            fieldCatalog,
            isActive: row.isActive,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            sourceDossier: row.sourceDossier,
        };
    },

    async create(input: { name: string; description?: string | null; dossierId: string }) {
        const dossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.id, input.dossierId)),
        });
        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }
        if (!dossier.ocrMetadataKey) {
            throw httpError.badRequest("Dossier has no OCR metadata");
        }

        const jsonKey = dossier.ocrMetadataKey.endsWith(".json")
            ? dossier.ocrMetadataKey
            : `${dossier.ocrMetadataKey}.json`;
        const raw = await downloadJsonFromStorage(jsonKey);
        if (!isDossierMetadata(raw)) {
            throw httpError.badRequest("Invalid OCR metadata format");
        }

        const catalog = extractFieldCatalog(raw);
        if (catalog.length === 0) {
            throw httpError.badRequest("OCR metadata has no fields to catalog");
        }

        const [inserted] = await db
            .insert(metadataTemplates)
            .values({
                name: input.name,
                description: input.description ?? null,
                sourceDossierId: dossier.id,
                sourceOcrMetadataKey: dossier.ocrMetadataKey,
                fieldCatalog: serializeFieldCatalog(catalog),
            })
            .returning();

        return mapTemplate(inserted!);
    },

    async update(id: string, input: { name?: string; description?: string | null }) {
        await this.get(id);
        const [updated] = await db
            .update(metadataTemplates)
            .set({
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
                updatedAt: new Date(),
            })
            .where(and(eq(metadataTemplates.id, id), isNull(metadataTemplates.deletedAt)))
            .returning();
        return mapTemplate(updated!);
    },

    async toggleActive(id: string, isActive?: boolean) {
        const item = await this.get(id);
        const newValue = isActive !== undefined ? isActive : !item.isActive;
        const [updated] = await db
            .update(metadataTemplates)
            .set({
                isActive: newValue,
                updatedAt: new Date(),
            })
            .where(and(eq(metadataTemplates.id, id), isNull(metadataTemplates.deletedAt)))
            .returning();
        return mapTemplate(updated!);
    },

    async delete(id: string) {
        await this.get(id);

        const inUse = await db.query.metadataPermissionConfigs.findFirst({
            where: and(
                eq(metadataPermissionConfigs.templateId, id),
                isNull(metadataPermissionConfigs.deletedAt),
            ),
            columns: { id: true },
        });
        if (inUse) {
            throw httpError.conflict("Template is used by an active permission config");
        }

        await db
            .update(metadataTemplates)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(metadataTemplates.id, id));

        return { status: "deleted" as const, id };
    },
};
