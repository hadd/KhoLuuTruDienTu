import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { pageQuotaCharges } from "../../db/schemas/page-quota.ts";
import {
    parseDossierMetadata,
    HO_SO_LUU_TRU_GROUP_CODE,
} from "../../libs/metadata-normalize.ts";
import type { DossierMetadata, MetadataField } from "../../libs/metadata-types.ts";

const DOCUMENT_PAGE_FIELDS = new Set([
    "SO_LUONG_TRANG",
    "SO_LUONG_TRANG_CUA_VAN_BAN",
]);

function normalizePath(value: string | null | undefined): string {
    return (value ?? "").trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function basename(value: string): string {
    const normalized = normalizePath(value);
    const parts = normalized.split("/");
    return parts[parts.length - 1] ?? normalized;
}

function parsePositiveInt(raw: string | null | undefined): number | null {
    if (raw == null) return null;
    const n = Number(String(raw).trim().replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
}

function pageCountFromFields(fields: MetadataField[]): number | null {
    for (const field of fields) {
        if (!DOCUMENT_PAGE_FIELDS.has(field.name)) continue;
        const parsed = parsePositiveInt(field.value);
        if (parsed != null) return parsed;
    }
    return null;
}

type JsonPdfEntry = {
    filePath: string | null;
    fileName: string | null;
    useJsonPageField: boolean;
    fields: MetadataField[];
};

function collectJsonPdfs(metadata: DossierMetadata): JsonPdfEntry[] {
    const seen = new Set<string>();
    const entries: JsonPdfEntry[] = [];

    const add = (
        filePath: string | null,
        fileName: string | null,
        useJsonPageField: boolean,
        fields: MetadataField[],
    ) => {
        const pathKey = normalizePath(filePath);
        const nameKey = normalizePath(fileName);
        const key = pathKey || nameKey;
        if (!key) return;
        if (seen.has(key)) return;
        seen.add(key);
        entries.push({ filePath, fileName, useJsonPageField, fields });
    };

    for (const group of metadata.metadata_groups) {
        const isHoSo = group.group_code === HO_SO_LUU_TRU_GROUP_CODE;
        add(
            group.source_document?.file_path ?? null,
            group.source_document?.file_name ?? null,
            !isHoSo,
            group.fields ?? [],
        );
        const nested = group.documents ?? group.document ?? [];
        for (const doc of nested) {
            add(
                doc.source_document?.file_path ?? null,
                doc.source_document?.file_name ?? null,
                true,
                doc.fields ?? [],
            );
        }
    }

    return entries;
}

function matchDbPageCount(
    entry: JsonPdfEntry,
    files: Array<{ filePath: string; fileName: string; pageCount: number }>,
): number | null {
    const pathKey = normalizePath(entry.filePath);
    const nameKey = basename(entry.fileName ?? entry.filePath ?? "");
    const byPath = pathKey
        ? files.find((file) => normalizePath(file.filePath) === pathKey)
        : undefined;
    if (byPath) return byPath.pageCount;
    if (!nameKey) return null;
    const byName = files.filter((file) => basename(file.fileName) === nameKey);
    if (byName.length === 1) return byName[0].pageCount;
    return null;
}

export async function countExtractedPages(input: {
    dossierId: string;
    metadata: unknown;
}): Promise<number> {
    const files = await db
        .select({
            filePath: dossierFiles.filePath,
            fileName: dossierFiles.fileName,
            pageCount: dossierFiles.pageCount,
        })
        .from(dossierFiles)
        .where(eq(dossierFiles.dossierId, input.dossierId));

    const fallbackSum = files.reduce((sum, file) => sum + (file.pageCount || 1), 0);

    const metadata = parseDossierMetadata(input.metadata);
    if (!metadata) {
        return Math.max(1, fallbackSum);
    }

    const jsonPdfs = collectJsonPdfs(metadata);
    if (jsonPdfs.length === 0) {
        return Math.max(1, fallbackSum);
    }

    let total = 0;
    for (const entry of jsonPdfs) {
        const fromDb = matchDbPageCount(entry, files);
        if (fromDb != null && fromDb > 0) {
            total += fromDb;
            continue;
        }
        if (entry.useJsonPageField) {
            const fromJson = pageCountFromFields(entry.fields);
            if (fromJson != null) {
                total += fromJson;
                continue;
            }
        }
        total += 1;
    }

    return Math.max(1, total);
}

export async function sumChargedPages(): Promise<number> {
    const [row] = await db
        .select({
            total: sql<number>`coalesce(sum(${pageQuotaCharges.pages}), 0)`,
        })
        .from(pageQuotaCharges);
    return Number(row?.total ?? 0);
}

/** Tổng trang PDF đã đăng ký nhưng hồ sơ chưa bị charge (chưa bóc tách xong). */
export async function sumPendingUnchargedPages(): Promise<number> {
    const [row] = await db
        .select({
            total: sql<number>`coalesce(sum(${dossierFiles.pageCount}), 0)`,
        })
        .from(dossierFiles)
        .innerJoin(dossiers, eq(dossierFiles.dossierId, dossiers.id))
        .leftJoin(pageQuotaCharges, eq(pageQuotaCharges.dossierId, dossiers.id))
        .where(and(isNull(dossiers.deletedAt), isNull(pageQuotaCharges.id)));
    return Number(row?.total ?? 0);
}
