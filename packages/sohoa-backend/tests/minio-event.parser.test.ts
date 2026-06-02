import { assertEquals } from "@std/assert";
import { parseMinioObjectCreatedKeys } from "../modules/ocr-callback/minio-event.parser.ts";
import { deriveFolderPath, deriveHoSoId, isOcrMetadataKey } from "../modules/ocr-callback/ocr-path-utils.ts";

const BUCKET = "data-lake";

function buildPayload(key: string, eventName = "s3:ObjectCreated:Put") {
    return {
        Records: [
            {
                eventName,
                s3: {
                    bucket: { name: BUCKET },
                    object: { key },
                },
            },
        ],
    };
}

Deno.test("isOcrMetadataKey accepts processed json keys only", () => {
    assertEquals(isOcrMetadataKey("processed/root/ho-so.json"), true);
    assertEquals(isOcrMetadataKey("processed/root/ho-so.txt"), false);
    assertEquals(isOcrMetadataKey("raw/root/ho-so.json"), false);
});

Deno.test("deriveFolderPath and deriveHoSoId map processed key to dossier path", () => {
    const outputPath = "processed/import-2024/ho-so-123.json";
    assertEquals(deriveHoSoId(outputPath), "ho-so-123");
    assertEquals(deriveFolderPath(outputPath), "raw/import-2024/ho-so-123");
});

Deno.test("parseMinioObjectCreatedKeys extracts processed json keys", () => {
    const keys = parseMinioObjectCreatedKeys(
        buildPayload("processed/import-2024/ho-so-123.json"),
        BUCKET,
    );
    assertEquals(keys, ["processed/import-2024/ho-so-123.json"]);
});

Deno.test("parseMinioObjectCreatedKeys ignores non-object-created events", () => {
    const keys = parseMinioObjectCreatedKeys(
        buildPayload("processed/root/ho-so.json", "s3:ObjectRemoved:Delete"),
        BUCKET,
    );
    assertEquals(keys, []);
});

Deno.test("parseMinioObjectCreatedKeys ignores wrong bucket", () => {
    const keys = parseMinioObjectCreatedKeys(
        {
            Records: [
                {
                    eventName: "s3:ObjectCreated:Put",
                    s3: {
                        bucket: { name: "other-bucket" },
                        object: { key: "processed/root/ho-so.json" },
                    },
                },
            ],
        },
        BUCKET,
    );
    assertEquals(keys, []);
});

Deno.test("parseMinioObjectCreatedKeys decodes URL-encoded keys", () => {
    const keys = parseMinioObjectCreatedKeys(
        buildPayload("processed/root/ho%20so.json"),
        BUCKET,
    );
    assertEquals(keys, ["processed/root/ho so.json"]);
});

Deno.test("parseMinioObjectCreatedKeys deduplicates repeated records", () => {
    const payload = {
        Records: [
            buildPayload("processed/root/ho-so.json").Records[0],
            buildPayload("processed/root/ho-so.json").Records[0],
        ],
    };
    const keys = parseMinioObjectCreatedKeys(payload, BUCKET);
    assertEquals(keys, ["processed/root/ho-so.json"]);
});
