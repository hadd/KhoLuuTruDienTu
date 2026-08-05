import { Kafka, logLevel, type Producer } from "kafkajs";
import { env } from "../env.ts";

let producer: Producer | null = null;
let connectPromise: Promise<Producer> | null = null;

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

async function getProducer(): Promise<Producer> {
    if (producer) return producer;
    if (connectPromise) return connectPromise;

    connectPromise = (async () => {
        const kafka = createKafkaInstance();
        const p = kafka.producer();
        await p.connect();
        producer = p;
        console.info(`[Kafka] Producer connected — broker: ${env.KAFKA_BROKER}`);
        return p;
    })();

    try {
        return await connectPromise;
    } catch (err) {
        connectPromise = null;
        throw err;
    }
}

export async function publishKafkaMessage(
    topic: string,
    payload: Record<string, unknown>,
): Promise<void> {
    if (!env.KAFKA_ENABLED) {
        throw new Error("Kafka producer is disabled (KAFKA_ENABLED=false)");
    }

    const p = await getProducer();
    const value = JSON.stringify(payload);
    await p.send({
        topic,
        messages: [{ value }],
    });
    console.info(`[Kafka] Published to ${topic}:`, value);
}
