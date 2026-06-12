/**
 * Test OCR webhook — gọi POST /api/v1/internal/ocr-callback
 *
 * Usage:
 *   deno task test:ocr-webhook
 *   deno task test:ocr-webhook -- --ho-so-id HS1 --output-path processed/BO_HS1_3_CAI/HS1/HS1.json
 *   deno task test:ocr-webhook -- --dossier-id <uuid>
 */

import { eq, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { env } from "../../env.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import {
    deriveHoSoIdFromProcessedKey,
    isDerivedProcessedMetadataKey,
    toProcessedMetadataKey,
} from "../../modules/dossier/dossier-path-utils.ts";

const BASE_URL = Deno.env.get("WEBHOOK_BASE_URL") ?? "http://localhost:8000";
const API_KEY = env.INTERNAL_API_KEY;

type CliArgs = {
    dossierId?: string;
    hoSoId?: string;
    outputPath?: string;
};

function parseArgs(): CliArgs {
    const args = Deno.args;
    const result: CliArgs = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const next = args[i + 1];
        if (arg === "--dossier-id" && next) {
            result.dossierId = next;
            i++;
        } else if (arg === "--ho-so-id" && next) {
            result.hoSoId = next;
            i++;
        } else if (arg === "--output-path" && next) {
            result.outputPath = next;
            i++;
        }
    }

    return result;
}

async function resolvePayload(cli: CliArgs): Promise<{ ho_so_id: string; output_path: string }> {
    if (cli.hoSoId && cli.outputPath) {
        return { ho_so_id: cli.hoSoId, output_path: cli.outputPath };
    }

    const dossier = cli.dossierId
        ? await db.query.dossiers.findFirst({
            where: eq(dossiers.id, cli.dossierId),
            columns: { id: true, folderPath: true, ocrMetadataKey: true, name: true },
        })
        : await db.query.dossiers.findFirst({
            where: isNull(dossiers.deletedAt),
            columns: { id: true, folderPath: true, ocrMetadataKey: true, name: true },
            orderBy: (table, { desc }) => [desc(table.updatedAt)],
        });

    if (!dossier) {
        throw new Error("Không tìm thấy dossier trong DB. Truyền --ho-so-id và --output-path thủ công.");
    }

    // Không dùng ocrMetadataKey nếu đang trỏ nhầm sang file _EDITOR / checker.
    const output_path = (
        dossier.ocrMetadataKey && !isDerivedProcessedMetadataKey(dossier.ocrMetadataKey)
            ? dossier.ocrMetadataKey
            : toProcessedMetadataKey(dossier.folderPath)
    );

    if (!output_path) {
        throw new Error(
            `Dossier ${dossier.id} không có ocrMetadataKey và không derive được output_path từ folderPath=${dossier.folderPath}`,
        );
    }

    const ho_so_id = deriveHoSoIdFromProcessedKey(output_path);

    console.info("Dossier mẫu:", {
        id: dossier.id,
        name: dossier.name,
        folderPath: dossier.folderPath,
        ocrMetadataKey: dossier.ocrMetadataKey,
    });

    return { ho_so_id, output_path };
}

async function callWebhook(payload: { ho_so_id: string; output_path: string }) {
    const url = `${BASE_URL}/api/v1/internal/ocr-callback`;

    console.info("\nGọi webhook:", url);
    console.info("Payload:", JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
        },
        body: JSON.stringify(payload),
    });

    const text = await response.text();
    let body: unknown = text;
    try {
        body = JSON.parse(text);
    } catch {
        // keep raw text
    }

    console.info(`\nResponse: HTTP ${response.status}`);
    console.info(JSON.stringify(body, null, 2));

    if (!response.ok) {
        Deno.exit(1);
    }

    const result = body as { acknowledged?: boolean; source?: string; skipped?: boolean; skipReason?: string };
    if (result.acknowledged && result.source === "webhook") {
        if (result.skipped) {
            console.info(`\n✅ Webhook bắt được — skipped (reason: ${result.skipReason}). Không emit Socket, không đổi DB.`);
        } else {
            console.info("\n✅ Webhook bắt được — server đã xử lý thành công.");
            console.info("   Kiểm tra log server: dòng [Webhook] OCR callback received/processed");
        }
    }
}

if (!API_KEY) {
    console.error("❌ INTERNAL_API_KEY chưa được cấu hình trong .env");
    Deno.exit(1);
}

try {
    const cli = parseArgs();
    const payload = await resolvePayload(cli);
    await callWebhook(payload);
} catch (error) {
    console.error("❌ Webhook test failed:", error);
    Deno.exit(1);
}
