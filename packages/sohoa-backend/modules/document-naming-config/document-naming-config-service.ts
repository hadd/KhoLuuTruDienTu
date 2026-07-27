import { httpError } from "@shared/common-lib";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { documentNamingConfigs } from "../../db/schemas/document-naming-config.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { fonds } from "../../db/schemas/fond.ts";
import {
    buildDocumentNamePreviewSamples,
    DOCUMENT_NAMING_FIELD_CATALOG,
    validateDocumentNamingSegments,
    type DocumentNamingSegment,
    type DocumentNamingTargetType,
} from "../../libs/document-naming-types.ts";

function mapConfig(row: {
    id: string;
    fondId: string;
    targetType: string;
    dossierId: string | null;
    segments: DocumentNamingSegment[];
    autoIncrementCounter: number;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: row.id,
        fondId: row.fondId,
        targetType: row.targetType as DocumentNamingTargetType,
        dossierId: row.dossierId,
        segments: row.segments,
        autoIncrementCounter: row.autoIncrementCounter,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function parseAutoIncrementStart(segments: DocumentNamingSegment[]): number {
    const autoSegment = segments.find((segment) => segment.source === "auto_increment");
    if (!autoSegment?.value) return 1;
    const parsed = Number.parseInt(autoSegment.value, 10);
    return Number.isFinite(parsed) ? parsed : 1;
}

export const DocumentNamingConfigService = {
    getFieldCatalog() {
        return DOCUMENT_NAMING_FIELD_CATALOG;
    },

    async listDossierOptions(input: {
        fondId: string;
        search?: string;
        limit?: number;
    }) {
        const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
        const search = input.search?.trim();

        const rows = await db.query.dossiers.findMany({
            where: and(
                eq(dossiers.fondId, input.fondId),
                isNull(dossiers.deletedAt),
                search
                    ? or(
                        ilike(dossiers.name, `%${search}%`),
                        ilike(dossiers.folderPath, `%${search}%`),
                    )
                    : undefined,
            ),
            columns: {
                id: true,
                name: true,
                folderPath: true,
            },
            orderBy: desc(dossiers.updatedAt),
            limit,
        });

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            folderPath: row.folderPath,
        }));
    },

    async getConfig(input: {
        fondId: string;
        targetType: DocumentNamingTargetType;
        dossierId?: string | null;
    }) {
        await this.assertFondExists(input.fondId);
        if (input.targetType === "file") {
            if (!input.dossierId) {
                throw httpError.badRequest("dossierId is required for file naming config");
            }
            await this.assertDossierInFond(input.fondId, input.dossierId);
        }

        const row = await db.query.documentNamingConfigs.findFirst({
            where: and(
                eq(documentNamingConfigs.fondId, input.fondId),
                eq(documentNamingConfigs.targetType, input.targetType),
                input.targetType === "dossier"
                    ? isNull(documentNamingConfigs.dossierId)
                    : eq(documentNamingConfigs.dossierId, input.dossierId!),
                isNull(documentNamingConfigs.deletedAt),
            ),
        });

        if (!row) {
            return {
                fondId: input.fondId,
                targetType: input.targetType,
                dossierId: input.targetType === "file" ? input.dossierId ?? null : null,
                segments: [] as DocumentNamingSegment[],
                autoIncrementCounter: 1,
            };
        }

        return mapConfig(row);
    },

    async upsertConfig(input: {
        fondId: string;
        targetType: DocumentNamingTargetType;
        dossierId?: string | null;
        segments: DocumentNamingSegment[];
    }) {
        await this.assertFondExists(input.fondId);
        if (input.targetType === "file") {
            if (!input.dossierId) {
                throw httpError.badRequest("dossierId is required for file naming config");
            }
            await this.assertDossierInFond(input.fondId, input.dossierId);
        }

        try {
            validateDocumentNamingSegments(input.segments);
        } catch (error) {
            throw httpError.badRequest(
                error instanceof Error ? error.message : "Invalid naming segments",
            );
        }

        const existing = await db.query.documentNamingConfigs.findFirst({
            where: and(
                eq(documentNamingConfigs.fondId, input.fondId),
                eq(documentNamingConfigs.targetType, input.targetType),
                input.targetType === "dossier"
                    ? isNull(documentNamingConfigs.dossierId)
                    : eq(documentNamingConfigs.dossierId, input.dossierId!),
                isNull(documentNamingConfigs.deletedAt),
            ),
        });

        const autoIncrementCounter = parseAutoIncrementStart(input.segments);

        if (existing) {
            const [row] = await db.update(documentNamingConfigs)
                .set({
                    segments: input.segments,
                    autoIncrementCounter,
                    updatedAt: new Date(),
                })
                .where(eq(documentNamingConfigs.id, existing.id))
                .returning();
            return mapConfig(row);
        }

        const [row] = await db.insert(documentNamingConfigs).values({
            fondId: input.fondId,
            targetType: input.targetType,
            dossierId: input.targetType === "file" ? input.dossierId ?? null : null,
            segments: input.segments,
            autoIncrementCounter,
        }).returning();

        return mapConfig(row);
    },

    async preview(input: {
        fondId: string;
        targetType: DocumentNamingTargetType;
        dossierId?: string | null;
        segments: DocumentNamingSegment[];
    }) {
        await this.assertFondExists(input.fondId);

        const fond = await db.query.fonds.findFirst({
            where: and(eq(fonds.id, input.fondId), isNull(fonds.deletedAt)),
        });
        if (!fond) {
            throw httpError.notFound("Fond not found");
        }

        let dossier: typeof dossiers.$inferSelect | null = null;
        if (input.dossierId) {
            dossier = await db.query.dossiers.findFirst({
                where: and(
                    eq(dossiers.id, input.dossierId),
                    eq(dossiers.fondId, input.fondId),
                    isNull(dossiers.deletedAt),
                ),
            }) ?? null;
        }

        try {
            validateDocumentNamingSegments(input.segments);
        } catch (error) {
            throw httpError.badRequest(
                error instanceof Error ? error.message : "Invalid naming segments",
            );
        }

        const autoIncrementStart = parseAutoIncrementStart(input.segments);
        const previews = buildDocumentNamePreviewSamples({
            segments: input.segments,
            fond: {
                id: fond.id,
                fondName: fond.fondName,
                archiveAgency: fond.archiveAgency,
                fondType: fond.fondType,
            },
            dossier: dossier
                ? {
                    name: dossier.name,
                    folderPath: dossier.folderPath,
                    projectCode: dossier.projectCode,
                    dossierTypeId: dossier.dossierTypeId,
                }
                : undefined,
            file: {
                fileName: "sample.pdf",
                documentTypeId: "sample-type",
            },
            autoIncrementStart,
        });

        return { previews };
    },

    async assertFondExists(fondId: string) {
        const fond = await db.query.fonds.findFirst({
            where: and(eq(fonds.id, fondId), isNull(fonds.deletedAt)),
            columns: { id: true },
        });
        if (!fond) {
            throw httpError.notFound("Fond not found");
        }
    },

    async assertDossierInFond(fondId: string, dossierId: string) {
        const dossier = await db.query.dossiers.findFirst({
            where: and(
                eq(dossiers.id, dossierId),
                eq(dossiers.fondId, fondId),
                isNull(dossiers.deletedAt),
            ),
            columns: { id: true },
        });
        if (!dossier) {
            throw httpError.notFound("Dossier not found in fond");
        }
    },
};
