import { desc, eq, like, or } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import {
    MetadataExtractMode,
    MetadataExtractTriggerMode,
    type MetadataExtractMode as MetadataExtractModeType,
    type MetadataExtractTriggerMode as MetadataExtractTriggerModeType,
} from "../../db/schemas/metadata-extract-settings.ts";
import { env } from "../../env.ts";
import { publishKafkaMessage } from "../../libs/kafka-producer.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import {
    normalizeStorageKey,
    storageDirname,
    toDocJsonDataLakeKey,
    toProcessedMetadataKey,
} from "../dossier/dossier-path-utils.ts";
import { getMetadataExtractMode } from "./metadata-extract-settings-service.ts";
import { assertExtractRoutingAllowed } from "../page-quota/page-quota-service.ts";

/**
 * Feature flag: Event Router (merge-finished-wait) + POST /metadata/extract.
 * Set false to fall back to legacy metadata-completed-only flow.
 */
export const ENABLE_METADATA_EXTRACT_ROUTER = true;

export type MetadataExtractKafkaPayload = {
    ho_so_id: string;
    json_path: string;
};

export type RouteMetadataExtractInput = {
    ho_so_id: string;
    json_path?: string | null;
    /** When set (API), overrides system settings. Event Router omits this. */
    mode?: MetadataExtractTriggerModeType | MetadataExtractModeType;
    actorId?: string | null;
    /** true when called from merge-finished-wait consumer */
    fromEventRouter?: boolean;
};

export type RouteMetadataExtractResult = {
    ho_so_id: string;
    dossierId: string;
    mode: string;
    json_path: string;
    topics: string[];
    status: DossierStatus;
    kafkaPublished: boolean;
};

async function resolveDossierByHoSoId(hoSoId: string) {
    const trimmed = hoSoId.trim();
    if (!trimmed) {
        throw httpError.badRequest("ho_so_id is required");
    }

    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(
            or(
                eq(dossiers.name, trimmed),
                eq(dossiers.folderPath, trimmed),
                like(dossiers.folderPath, `%/${trimmed}`),
            ),
        ),
        orderBy: [desc(dossiers.updatedAt)],
    });

    if (!dossier) {
        throw httpError.notFound(`Dossier not found for ho_so_id: ${trimmed}`);
    }

    return dossier;
}

function deriveFolderPathFromDocJsonPath(
    jsonPath: string,
    rawPrefix = env.STORAGE_RAW_PREFIX ?? "raw",
): string | null {
    const normalized = normalizeStorageKey(jsonPath);
    if (!normalized.startsWith("doc_json/")) return null;
    const inner = normalized.slice("doc_json/".length);
    const dir = storageDirname(inner);
    if (!dir) return null;
    return `${rawPrefix}/${dir}`;
}

function resolveJsonPath(
    dossier: { folderPath: string; mergeJsonPath: string | null },
    jsonPath?: string | null,
): string {
    if (jsonPath?.trim()) {
        return normalizeStorageKey(jsonPath.trim());
    }
    if (dossier.mergeJsonPath?.trim()) {
        return normalizeStorageKey(dossier.mergeJsonPath.trim());
    }
    // Fallback: Ưu tiên tính đường dẫn doc_json vì đây là nơi NiFi xuất kết quả merge
    const docJsonKey = toDocJsonDataLakeKey(dossier.folderPath);
    if (docJsonKey) {
        return docJsonKey;
    }
    const derived = toProcessedMetadataKey(dossier.folderPath);
    if (!derived) {
        throw httpError.badRequest(
            `Cannot derive json_path from folderPath: ${dossier.folderPath}`,
        );
    }
    return derived;
}

function resolvePublishTopics(
    mode: MetadataExtractTriggerModeType | MetadataExtractModeType,
): string[] {
    if (mode === MetadataExtractTriggerMode.BOTH) {
        return [
            env.KAFKA_MERGE_COMPLETED_TOPIC,
            env.KAFKA_START_METADATA_TT05_TOPIC,
            env.KAFKA_START_METADATA_PVEP_TOPIC,
        ];
    }
    if (mode === MetadataExtractMode.OLD) {
        return [env.KAFKA_MERGE_COMPLETED_TOPIC];
    }
    if (mode === MetadataExtractMode.TT05) {
        return [env.KAFKA_START_METADATA_TT05_TOPIC];
    }
    if (mode === MetadataExtractMode.PVEP) {
        return [env.KAFKA_START_METADATA_PVEP_TOPIC];
    }
    // off
    return [];
}

/**
 * Shared router for Event Router (merge-finished-wait) and POST /metadata/extract.
 * Does not read files.ocr_run_mode — OCR auto/manual is a separate step.
 */
export async function routeMetadataExtract(
    input: RouteMetadataExtractInput,
): Promise<RouteMetadataExtractResult> {
    // TEMP: chặn toàn bộ publish Kafka + đổi status của luồng extract mới
    if (!ENABLE_METADATA_EXTRACT_ROUTER) {
        throw httpError.serviceUnavailable(
            "Metadata extract router is temporarily disabled (legacy OCR/upload flow only)",
        );
    }

    const hoSoId = input.ho_so_id.trim();
    let dossier = await resolveDossierByHoSoId(hoSoId).catch(() => null);

    // Fallback: Tìm dossier từ json_path nếu ho_so_id (document_id) không khớp với tên hồ sơ.
    if (!dossier && input.json_path) {
        const derivedFolder = deriveFolderPathFromDocJsonPath(input.json_path);
        if (derivedFolder) {
            dossier = await db.query.dossiers.findFirst({
                where: activeDossierWhere(eq(dossiers.folderPath, derivedFolder)),
            }) ?? null;
            if (dossier) {
                console.info(
                    `[Router] Resolved dossier "${dossier.name}" via json_path fallback` +
                    ` (document_id="${hoSoId}" → folderPath="${derivedFolder}")`,
                );
            }
        }
    }

    if (!dossier) {
        throw httpError.notFound(
            `Dossier not found for ho_so_id="${hoSoId}"` +
            (input.json_path ? ` json_path="${input.json_path}"` : ""),
        );
    }

    const jsonPath = resolveJsonPath(dossier, input.json_path);

    const mode: MetadataExtractTriggerModeType | MetadataExtractModeType =
        input.mode ?? (await getMetadataExtractMode());

    let topics = resolvePublishTopics(mode);
    const isOffMode = mode === MetadataExtractMode.OFF;
    let quotaBlocked = false;

    if (!isOffMode && topics.length > 0) {
        const gate = await assertExtractRoutingAllowed();
        if (!gate.allowed) {
            quotaBlocked = true;
            console.warn(
                `[MetadataExtract] ${gate.reason} used=${gate.usedPages} limit=${gate.pageLimit} — skip Kafka for ho_so_id=${hoSoId}`,
            );
            topics = [];
        }
    }

    console.info(
        `[MetadataExtract] ho_so_id=${hoSoId} | mode=${mode} | json_path=${jsonPath} | topics=[${topics.join(",") || "(none)"}]`,
    );

    const fromStatus = dossier.status;
    const shouldAdvance =
        fromStatus === DossierStatus.NEW ||
        fromStatus === DossierStatus.OCR_FAILED ||
        fromStatus === DossierStatus.OCR_PROCESSING;
    const nextStatus = shouldAdvance ? DossierStatus.OCR_PROCESSING : fromStatus;

    const kafkaPublished = !isOffMode && topics.length > 0;

    if (kafkaPublished) {
        if (!env.KAFKA_ENABLED) {
            // KAFKA_ENABLED=false: không publish nhưng vẫn update DB và log cảnh báo rõ ràng.
            // Không throw để tránh làm mất workflow log và mergeJsonPath.
            console.warn(
                `[MetadataExtract] KAFKA_ENABLED=false — bỏ qua publish topics=[${topics.join(",")}] cho ho_so_id=${hoSoId}. Hãy set KAFKA_ENABLED=true trong .env để AI nhận được message.`,
            );
        } else {
            const payload: MetadataExtractKafkaPayload = {
                ho_so_id: hoSoId,
                json_path: jsonPath,
            };
            for (const topic of topics) {
                await publishKafkaMessage(topic, payload);
                console.info(
                    `[MetadataExtract] Published → topic=${topic} | ho_so_id=${hoSoId} | json_path=${jsonPath}`,
                );
            }
        }
    } else if (isOffMode) {
        console.info(`[MetadataExtract] mode=off — không publish Kafka. Chờ manual trigger.`);
    } else if (quotaBlocked) {
        console.info(`[MetadataExtract] page quota blocked — không publish Kafka.`);
    }

    const action = isOffMode
        ? "MERGE_FINISHED_WAIT"
        : quotaBlocked
        ? "PAGE_QUOTA_EXCEEDED"
        : "METADATA_EXTRACT_TRIGGERED";
    const notes = isOffMode
        ? `Merge finished; extract mode off. Waiting for manual trigger. json_path=${jsonPath}`
        : quotaBlocked
        ? `Page quota exceeded or license invalid. Kafka extract routing skipped. json_path=${jsonPath}`
        : `Metadata extract triggered (mode=${mode}) topics=${topics.join(",")}`;

    await db.transaction(async (tx) => {
        await tx
            .update(dossiers)
            .set({
                mergeJsonPath: jsonPath,
                status: nextStatus,
                updatedAt: new Date(),
            })
            .where(eq(dossiers.id, dossier.id));

        await tx.insert(workflowLogs).values({
            dossierId: dossier.id,
            actorId: input.actorId ?? null,
            action,
            fromStatus,
            toStatus: nextStatus,
            notes,
        });
    });

    return {
        ho_so_id: hoSoId,
        dossierId: dossier.id,
        mode,
        json_path: jsonPath,
        topics,
        status: nextStatus,
        kafkaPublished,
    };
}

/**
 * Event Router entry: always uses system-wide settings mode.
 */
export async function handleMergeFinishedWait(input: {
    ho_so_id: string;
    json_path?: string;
}): Promise<RouteMetadataExtractResult> {
    return routeMetadataExtract({
        ho_so_id: input.ho_so_id,
        json_path: input.json_path,
        fromEventRouter: true,
    });
}
