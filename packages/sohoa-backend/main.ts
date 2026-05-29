import "./server.ts";
import { env } from "./env.ts";
import { startKafkaConsumer } from "./libs/kafka-consumer.ts";

if (env.NODE_ENV !== "test" && env.KAFKA_ENABLED) {
    startKafkaConsumer().catch((err) => {
        console.error("[Kafka] Consumer failed to start:", err);
    });
} else if (env.NODE_ENV !== "test") {
    console.info("[Kafka] Consumer disabled (KAFKA_ENABLED=false)");
}