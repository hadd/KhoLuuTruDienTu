import { Kafka, logLevel } from "kafkajs";
import { env } from "../env.ts";
import { handleOcrCallback } from "../modules/ocr-callback/ocr-callback-service.ts";

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

export async function startKafkaConsumer(): Promise<void> {
    const kafka = createKafkaInstance();
    const consumer = kafka.consumer({ groupId: env.KAFKA_GROUP_ID });

    await consumer.connect();
    console.info(`[Kafka] Connected — group: ${env.KAFKA_GROUP_ID}`);

    await consumer.subscribe({
        topic: env.KAFKA_METADATA_TOPIC,
        fromBeginning: false,
    });
    console.info(`[Kafka] Subscribed to topic: ${env.KAFKA_METADATA_TOPIC}`);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const raw = message.value?.toString();

            if (!raw) {
                console.warn(`[Kafka] Empty message on ${topic}[${partition}]`);
                return;
            }

            let payload: { ho_so_id: string; output_path: string };
            try {
                payload = JSON.parse(raw);
            } catch (err) {
                console.error(`[Kafka] JSON parse error on ${topic}[${partition}]:`, err, "| raw:", raw);
                return;
            }

            if (!payload.ho_so_id || !payload.output_path) {
                console.warn(`[Kafka] Message missing required fields:`, payload);
                return;
            }

            try {
                const result = await handleOcrCallback(payload);
                console.info(
                    `[Kafka] OCR callback processed — dossierId: ${result.dossierId}, status: ${result.status}`,
                );
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                // 404 = dossier not found, log as warning and skip
                if (message.includes("not found")) {
                    console.warn(`[Kafka] Dossier not found for output_path: ${payload.output_path}`);
                } else {
                    console.error(`[Kafka] Failed to process OCR callback:`, err);
                }
            }
        },
    });
}
