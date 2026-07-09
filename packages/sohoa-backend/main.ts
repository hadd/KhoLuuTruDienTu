import "./server.ts";
import { env } from "./env.ts";
import { configureSearchEngine, ensureAllIndices } from "@shared/search-engine";
import { DOSSIER_ENTITY_TYPE } from "./modules/search/adapters/dossier.adapter.ts";
import { FOND_ENTITY_TYPE } from "./modules/search/adapters/fond.adapter.ts";
import { startKafkaConsumer } from "./libs/kafka-consumer.ts";
import { startOcrScanner } from "./libs/ocr-scanner.ts";

configureSearchEngine({
    enabled: env.ELASTICSEARCH_ENABLED,
    url: env.ELASTICSEARCH_URL,
});

if (env.ELASTICSEARCH_ENABLED) {
    ensureAllIndices([DOSSIER_ENTITY_TYPE, FOND_ENTITY_TYPE]).catch((err) => {
        console.error("[Search] Failed to ensure indices:", err);
    });
} else {
    console.info("[Search] Elasticsearch disabled (ELASTICSEARCH_ENABLED=false)");
}

// Safety net: prevent uncaught errors (e.g. XML parser exceptions from stream
// callbacks) from taking down the entire process. Log them instead.
process.on("uncaughtException", (err: Error) => {
    console.error("[Process] Uncaught exception (server kept alive):", err);
});

process.on("unhandledRejection", (reason: unknown) => {
    console.error("[Process] Unhandled rejection (server kept alive):", reason);
});

if (env.NODE_ENV !== "test") {
    if (env.KAFKA_ENABLED) {
        startKafkaConsumer().catch((err) => {
            console.error("[Kafka] Consumer failed to start:", err);
        });
    } else {
        console.info("[Kafka] Consumer disabled (KAFKA_ENABLED=false)");
    }

    if (env.SCANNER_ENABLED) {
        startOcrScanner(env.SCANNER_INTERVAL_MS);
    } else {
        console.info("[Scanner] OCR scanner disabled (SCANNER_ENABLED=false)");
    }
}
