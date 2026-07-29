import { and, eq, isNull, sql } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import {
    findHoSoFondFieldValue,
    findMetadataFieldValue,
    formatDossierMetadataForStorage,
    HO_SO_FOND_FIELD,
    HO_SO_LUU_TRU_GROUP_CODE,
    parseDossierMetadata,
    TAI_LIEU_LUU_TRU_GROUP_CODE,
} from "../../libs/metadata-normalize.ts";
import type { DossierMetadata, MetadataField, MetadataGroup } from "../../libs/metadata-types.ts";
import { isDossierMetadata } from "../../libs/metadata-types.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { storageBasename } from "../dossier/dossier-path-utils.ts";
import { syncDossierFondIdFromMetadata } from "../dossier/dossier-fond-sync.ts";
import {
    buildSummaryMetadataUpdateKey,
    downloadJsonFromStorage,
    resolveMetadataJsonKey,
    uploadJsonToStorage,
} from "../data-entry/data-entry-s3-utils.ts";

export const MUC_DO_TIEP_CAN_FIELD = "MUC_DO_TIEP_CAN";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ArchivePdfFileRef = {
    id: string;
    filePath: string;
    securityLevelId: string | null;
};

export type ArchiveMetadataPrefill = {
    fondId: string | null;
    dossierSecurityLevelId: string | null;
    fileSecurityByFileId: Record<string, string | null>;
    suggestedFieldValues: Record<string, string>;
};

export type ArchiveMetadataSubmitPatch = {
    fondId: string | null;
    dossierSecurityLevelName: string | null;
    fileSecurityLevels: Array<{
        fileId: string;
        filePath: string;
        securityLevelName: string | null;
    }>;
};

export function normalizeArchiveFilePathKey(filePath: string): string {
    return storageBasename(filePath).trim().toLowerCase();
}

export function metadataDocumentMatchesFilePath(
    documentPath: string | null | undefined,
    filePath: string,
): boolean {
    if (!documentPath?.trim()) return false;
    const docKey = normalizeArchiveFilePathKey(documentPath);
    const fileKey = normalizeArchiveFilePathKey(filePath);
    if (docKey === fileKey) return true;
    return documentPath.replace(/\\/g, "/").toLowerCase().endsWith(`/${fileKey}`);
}

export async function resolveFondIdFromMetadataValue(
    raw: string | null | undefined,
): Promise<string | null> {
    const trimmed = raw?.trim();
    if (!trimmed) return null;

    const [byId] = await db
        .select({ id: fonds.id })
        .from(fonds)
        .where(and(
            eq(fonds.id, trimmed),
            eq(fonds.isActive, true),
            isNull(fonds.deletedAt),
        ))
        .limit(1);
    if (byId) return byId.id;

    const [byName] = await db
        .select({ id: fonds.id })
        .from(fonds)
        .where(and(
            sql`lower(${fonds.fondName}) = lower(${trimmed})`,
            eq(fonds.isActive, true),
            isNull(fonds.deletedAt),
        ))
        .limit(1);
    return byName?.id ?? null;
}

export async function resolveSecurityLevelIdByName(
    name: string | null | undefined,
): Promise<string | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;

    const [row] = await db
        .select({ id: securityLevels.id })
        .from(securityLevels)
        .where(and(
            sql`lower(${securityLevels.name}) = lower(${trimmed})`,
            eq(securityLevels.isActive, true),
            isNull(securityLevels.deletedAt),
        ))
        .limit(1);
    return row?.id ?? null;
}

export async function resolveSecurityLevelNameById(
    id: string | null | undefined,
): Promise<string | null> {
    const trimmed = id?.trim();
    if (!trimmed) return null;

    const [row] = await db
        .select({ name: securityLevels.name })
        .from(securityLevels)
        .where(and(
            eq(securityLevels.id, trimmed),
            eq(securityLevels.isActive, true),
            isNull(securityLevels.deletedAt),
        ))
        .limit(1);
    return row?.name ?? null;
}

function findHoSoGroup(metadata: DossierMetadata): MetadataGroup | undefined {
    return metadata.metadata_groups.find(
        (group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
    );
}

function findDocumentAccessLevel(
    metadata: DossierMetadata,
    filePath: string,
): string | null {
    for (const group of metadata.metadata_groups) {
        if (group.group_code !== TAI_LIEU_LUU_TRU_GROUP_CODE) continue;
        if (!metadataDocumentMatchesFilePath(group.source_document?.file_path, filePath)) {
            continue;
        }
        return findMetadataFieldValue(group.fields, MUC_DO_TIEP_CAN_FIELD);
    }
    return null;
}

function upsertMetadataField(
    fields: MetadataField[],
    fieldName: string,
    display: string,
    value: string,
): MetadataField[] {
    const normalized = fieldName.trim().toUpperCase();
    let found = false;
    const next = fields.map((field) => {
        if (field.name.trim().toUpperCase() !== normalized) return field;
        found = true;
        return { ...field, value };
    });
    if (!found) {
        next.push({
            name: fieldName,
            display,
            type: "string",
            value,
            page: null,
            bbox: null,
        });
    }
    return next;
}

export async function extractArchivePrefillFromMetadata(
    metadata: DossierMetadata,
    input: {
        dossierFondId?: string | null;
        dossierSecurityLevelId?: string | null;
        pdfFiles: ArchivePdfFileRef[];
    },
): Promise<ArchiveMetadataPrefill> {
    const hoSoGroup = findHoSoGroup(metadata);
    const fondRaw = findHoSoFondFieldValue(metadata) ?? input.dossierFondId ?? null;
    const fondId = await resolveFondIdFromMetadataValue(fondRaw)
        ?? (input.dossierFondId?.trim() || null);

    const dossierAccessRaw = hoSoGroup
        ? findMetadataFieldValue(hoSoGroup.fields, MUC_DO_TIEP_CAN_FIELD)
        : null;
    const dossierSecurityLevelId = (await resolveSecurityLevelIdByName(dossierAccessRaw))
        ?? input.dossierSecurityLevelId
        ?? null;

    const fileSecurityByFileId: Record<string, string | null> = {};
    for (const file of input.pdfFiles) {
        const documentAccessRaw = findDocumentAccessLevel(metadata, file.filePath);
        fileSecurityByFileId[file.id] = (await resolveSecurityLevelIdByName(documentAccessRaw))
            ?? file.securityLevelId
            ?? dossierSecurityLevelId;
    }

    const suggestedFieldValues: Record<string, string> = {};
    if (fondId) {
        suggestedFieldValues.fond = fondId;
    }

    return {
        fondId,
        dossierSecurityLevelId,
        fileSecurityByFileId,
        suggestedFieldValues,
    };
}

export function patchMetadataForArchiveSubmit(
    metadata: DossierMetadata,
    input: ArchiveMetadataSubmitPatch,
): DossierMetadata {
    const metadata_groups = metadata.metadata_groups.map((group) => {
        if (group.group_code === HO_SO_LUU_TRU_GROUP_CODE) {
            let fields = [...group.fields];
            if (input.fondId) {
                fields = upsertMetadataField(
                    fields,
                    HO_SO_FOND_FIELD,
                    "Phông lưu trữ",
                    input.fondId,
                );
            }
            if (input.dossierSecurityLevelName) {
                fields = upsertMetadataField(
                    fields,
                    MUC_DO_TIEP_CAN_FIELD,
                    "Mức độ tiếp cận",
                    input.dossierSecurityLevelName,
                );
            }
            return { ...group, fields };
        }

        if (group.group_code !== TAI_LIEU_LUU_TRU_GROUP_CODE) {
            return group;
        }

        const filePatch = input.fileSecurityLevels.find((item) =>
            metadataDocumentMatchesFilePath(group.source_document?.file_path, item.filePath)
        );
        if (!filePatch?.securityLevelName) {
            return group;
        }

        return {
            ...group,
            fields: upsertMetadataField(
                group.fields,
                MUC_DO_TIEP_CAN_FIELD,
                "Mức độ tiếp cận",
                filePatch.securityLevelName,
            ),
        };
    });

    return { ...metadata, metadata_groups };
}

export async function loadDossierMetadataForArchive(
    dossierId: string,
): Promise<DossierMetadata> {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
        columns: {
            currentMetadataKey: true,
            ocrMetadataKey: true,
        },
    });
    if (!dossier) {
        throw httpError.notFound("Hồ sơ không tồn tại");
    }

    const metadataKey = dossier.currentMetadataKey ?? dossier.ocrMetadataKey;
    if (!metadataKey?.trim()) {
        throw httpError.badRequest("Hồ sơ chưa có metadata để nộp lưu kho");
    }

    const raw = await downloadJsonFromStorage(resolveMetadataJsonKey(metadataKey));
    if (!isDossierMetadata(raw)) {
        throw httpError.badRequest("Metadata hồ sơ không hợp lệ");
    }

    const parsed = parseDossierMetadata(raw);
    if (!parsed) {
        throw httpError.badRequest("Metadata hồ sơ không hợp lệ");
    }
    return parsed;
}

export async function persistDossierMetadataForArchive(
    dossierId: string,
    metadata: DossierMetadata,
    tx?: DbTx,
): Promise<string> {
    const executor = tx ?? db;
    const dossier = await executor.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
        columns: {
            currentMetadataKey: true,
            ocrMetadataKey: true,
        },
    });
    if (!dossier) {
        throw httpError.notFound("Hồ sơ không tồn tại");
    }

    const baseKey = dossier.currentMetadataKey ?? dossier.ocrMetadataKey;
    if (!baseKey?.trim()) {
        throw httpError.badRequest("Hồ sơ chưa có metadata để cập nhật");
    }

    const storageMetadata = formatDossierMetadataForStorage(metadata);
    const storedKey = await uploadJsonToStorage(
        buildSummaryMetadataUpdateKey(baseKey),
        storageMetadata,
    );
    const now = new Date();

    await executor
        .update(dossiers)
        .set({
            currentMetadataKey: storedKey,
            updatedAt: now,
        })
        .where(activeDossierWhere(eq(dossiers.id, dossierId)));

    await syncDossierFondIdFromMetadata(dossierId, storageMetadata, tx);

    return storedKey;
}

export async function buildArchiveMetadataSubmitPatch(input: {
    fondId: string | null;
    dossierSecurityLevelId: string;
    fileSecurityLevels: Array<{
        fileId: string;
        filePath: string;
        securityLevelId: string;
    }>;
}): Promise<ArchiveMetadataSubmitPatch> {
    const dossierSecurityLevelName = await resolveSecurityLevelNameById(
        input.dossierSecurityLevelId,
    );
    const fileSecurityLevels = await Promise.all(
        input.fileSecurityLevels.map(async (item) => ({
            fileId: item.fileId,
            filePath: item.filePath,
            securityLevelName: await resolveSecurityLevelNameById(item.securityLevelId),
        })),
    );

    return {
        fondId: input.fondId,
        dossierSecurityLevelName,
        fileSecurityLevels,
    };
}
