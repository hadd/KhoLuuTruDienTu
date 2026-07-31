import "./server.ts";
import { env } from "./env.ts";
import { configureSearchEngine, ensureAllIndices } from "@shared/search-engine";
import { DOSSIER_ENTITY_TYPE } from "./modules/search/adapters/dossier.adapter.ts";
import { FOND_ENTITY_TYPE } from "./modules/search/adapters/fond.adapter.ts";
import { startKafkaConsumer } from "./libs/kafka-consumer.ts";
import { startOcrScanner } from "./libs/ocr-scanner.ts";
import { startSearchIndexWorker } from "./modules/search/search-index-queue.ts";
import { loadAuditLogConfigCache } from "./modules/audit-log-config/index.ts";
import { startAuditLogPurgeWorker } from "./modules/audit-log/audit-log-purge-worker.ts";
import { startArchiveBorrowExpiryWorker } from "./modules/archive-borrow/index.ts";

configureSearchEngine({
    enabled: env.ELASTICSEARCH_ENABLED,
    url: env.ELASTICSEARCH_URL,
});

if (env.ELASTICSEARCH_ENABLED) {
    const maxAttempts = 8;
    const delayMs = 3000;
    (async () => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await ensureAllIndices([DOSSIER_ENTITY_TYPE, FOND_ENTITY_TYPE]);
                if (attempt > 1) {
                    console.info(`[Search] Indices ensured after ${attempt} attempts`);
                }
                return;
            } catch (err) {
                const last = attempt === maxAttempts;
                console.error(
                    `[Search] Failed to ensure indices (attempt ${attempt}/${maxAttempts}):`,
                    last ? err : (err as Error)?.message ?? err,
                );
                if (last) return;
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    })();
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

    if (env.ELASTICSEARCH_ENABLED) {
        startSearchIndexWorker(env.SEARCH_INDEX_WORKER_INTERVAL_MS);
    }

    loadAuditLogConfigCache().catch((err) => {
        console.error("[AuditLog] Failed to load config cache:", err);
    });

    if (env.AUDIT_LOG_PURGE_ENABLED) {
        startAuditLogPurgeWorker(env.AUDIT_LOG_PURGE_INTERVAL_MS);
    } else {
        console.info("[AuditLog] Purge worker disabled (AUDIT_LOG_PURGE_ENABLED=false)");
    }

    if (env.ARCHIVE_BORROW_EXPIRY_ENABLED) {
        startArchiveBorrowExpiryWorker(env.ARCHIVE_BORROW_EXPIRY_INTERVAL_MS);
    } else {
        console.info("[ArchiveBorrow] Expiry worker disabled (ARCHIVE_BORROW_EXPIRY_ENABLED=false)");
    }
}
