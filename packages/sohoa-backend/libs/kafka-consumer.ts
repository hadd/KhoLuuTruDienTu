import { Kafka, logLevel } from "kafkajs";
import { env } from "../env.ts";
import { handleOcrCallback } from "../modules/ocr-callback/ocr-callback-service.ts";
// TEMP: tắt Event Router metadata extract — không ảnh hưởng luồng upload/OCR cũ
// import { handleMergeFinishedWait } from "../modules/metadata-extract/metadata-extract-router-service.ts";

/**
 * TEMP (2026-08): chỉ giữ consumer metadata-completed như trước.
 * Bật lại khi tích hợp merge-finished-wait / tt05-metadata-completed.
 */
const ENABLE_METADATA_EXTRACT_KAFKA_ROUTER = false;

function createKafkaInstance() {
    return new Kafka({
        brokers: [env.KAFKA_BROKER],
        logLevel: logLevel.WARN,
        retry: {
            initialRetryTime: 3000,
            retries: 10,
        },
    });
}

function parseJsonMessage(raw: string): Record<string, unknown> | null {
    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
        console.error(`[Kafka] JSON parse error:`, err, "| raw:", raw);
        return null;
    }
}

function asNonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/** Normalize completed-callback payloads (legacy output_path or json_path). */
function resolveCompletedOutputPath(payload: Record<string, unknown>): string | null {
    return asNonEmptyString(payload.output_path) ?? asNonEmptyString(payload.json_path);
}

async function handleCompletedCallback(
    topic: string,
    payload: Record<string, unknown>,
): Promise<void> {
    const hoSoId = asNonEmptyString(payload.ho_so_id);
    const outputPath = resolveCompletedOutputPath(payload);

    if (!hoSoId || !outputPath) {
        console.warn(`[Kafka] Message missing required fields on ${topic}:`, payload);
        return;
    }

    try {
        const result = await handleOcrCallback({
            ho_so_id: hoSoId,
            output_path: outputPath,
        });
        console.info(
            `[Kafka] OCR callback processed (${topic}) — dossierId: ${result.dossierId}, status: ${result.status}`,
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("not found")) {
            console.warn(`[Kafka] Dossier not found for output_path: ${outputPath}`);
        } else {
            console.error(`[Kafka] Failed to process OCR callback (${topic}):`, err);
        }
    }
}

// TEMP: tắt handler merge-finished-wait
// async function handleMergeFinished(
//     topic: string,
//     payload: Record<string, unknown>,
// ): Promise<void> {
//     const hoSoId = asNonEmptyString(payload.ho_so_id);
//     const jsonPath = asNonEmptyString(payload.json_path);
//
//     if (!hoSoId) {
//         console.warn(`[Kafka] Message missing ho_so_id on ${topic}:`, payload);
//         return;
//     }
//
//     try {
//         const result = await handleMergeFinishedWait({
//             ho_so_id: hoSoId,
//             json_path: jsonPath ?? undefined,
//         });
//         console.info(
//             `[Kafka] Merge-finished routed — dossierId: ${result.dossierId}, mode: ${result.mode}, topics: ${result.topics.join(",") || "(none)"}`,
//         );
//     } catch (err: unknown) {
//         const message = err instanceof Error ? err.message : String(err);
//         if (message.includes("not found")) {
//             console.warn(`[Kafka] Dossier not found for ho_so_id: ${hoSoId}`);
//         } else {
//             console.error(`[Kafka] Failed to route merge-finished-wait:`, err);
//         }
//     }
// }

export async function startKafkaConsumer(): Promise<void> {
    console.info(`[Kafka] Connecting to broker: ${env.KAFKA_BROKER}`);
    const kafka = createKafkaInstance();
    const consumer = kafka.consumer({ groupId: env.KAFKA_GROUP_ID });

    await consumer.connect();
    console.info(`[Kafka] Connected — group: ${env.KAFKA_GROUP_ID}`);

    // Chỉ subscribe metadata-completed (luồng cũ). Topics mới tạm tắt.
    const topics = [env.KAFKA_METADATA_TOPIC];
    // TEMP: bật lại khi sẵn sàng tích hợp
    // if (ENABLE_METADATA_EXTRACT_KAFKA_ROUTER) {
    //     topics.push(env.KAFKA_TT05_METADATA_TOPIC, env.KAFKA_MERGE_FINISHED_WAIT_TOPIC);
    // }
    void ENABLE_METADATA_EXTRACT_KAFKA_ROUTER;

    for (const topic of topics) {
        await consumer.subscribe({ topic, fromBeginning: false });
        console.info(`[Kafka] Subscribed to topic: ${topic}`);
    }

    if (!ENABLE_METADATA_EXTRACT_KAFKA_ROUTER) {
        console.info(
            "[Kafka] Metadata extract Event Router temporarily disabled (legacy metadata-completed only)",
        );
    }

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const raw = message.value?.toString();

            if (!raw) {
                console.warn(`[Kafka] Empty message on ${topic}[${partition}]`);
                return;
            }

            const payload = parseJsonMessage(raw);
            if (!payload) return;

            // TEMP: tắt route merge-finished-wait
            // if (topic === env.KAFKA_MERGE_FINISHED_WAIT_TOPIC) {
            //     await handleMergeFinished(topic, payload);
            //     return;
            // }

            // TEMP: chỉ xử lý metadata-completed; tt05-metadata-completed cũng tắt
            // if (
            //     topic === env.KAFKA_METADATA_TOPIC ||
            //     topic === env.KAFKA_TT05_METADATA_TOPIC
            // ) {
            if (topic === env.KAFKA_METADATA_TOPIC) {
                await handleCompletedCallback(topic, payload);
                return;
            }

            console.warn(`[Kafka] Unhandled topic: ${topic}`);
        },
    });
}
