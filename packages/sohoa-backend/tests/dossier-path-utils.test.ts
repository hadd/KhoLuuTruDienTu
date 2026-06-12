import { assertEquals } from "@std/assert";
import {
    deriveFolderPathFromProcessedKey,
    deriveHoSoIdFromProcessedKey,
    expandKeysWithDocJsonMirrors,
    folderNameFromPath,
    isDerivedProcessedMetadataKey,
    normalizeStorageKey,
    splitFolderSegments,
    storageBasename,
    storageDirname,
    toDocJsonDataLakeKey,
    toDocJsonDataLakePrefix,
    toProcessedMetadataKey,
} from "../modules/dossier/dossier-path-utils.ts";

Deno.test("normalizeStorageKey strips leading slashes", () => {
    assertEquals(normalizeStorageKey("/imports/a.pdf"), "imports/a.pdf");
});

Deno.test("splitFolderSegments builds cumulative paths", () => {
    assertEquals(splitFolderSegments("imports/2024/ho-so-123"), [
        "imports",
        "imports/2024",
        "imports/2024/ho-so-123",
    ]);
});

Deno.test("toDocJsonDataLakeKey mirrors raw only and maps .pdf to .json", () => {
    assertEquals(
        toDocJsonDataLakeKey("raw/batch-1/ho-so-123/scan.pdf"),
        "doc_json/batch-1/ho-so-123/scan.json",
    );
    assertEquals(
        toDocJsonDataLakeKey("raw/batch-1/ho-so-123/metadata/ocr-result.json"),
        "doc_json/batch-1/ho-so-123/metadata/ocr-result.json",
    );
    assertEquals(toDocJsonDataLakeKey("processed/batch-1/ho-so-123/ho-so-123.json"), null);
    assertEquals(toDocJsonDataLakePrefix("raw/batch-1/ho-so-123"), "doc_json/batch-1/ho-so-123/");
});

Deno.test("toProcessedMetadataKey mirrors raw folder to nested processed json", () => {
    assertEquals(
        toProcessedMetadataKey("raw/batch-1/ho-so-123"),
        "processed/batch-1/ho-so-123/ho-so-123.json",
    );
    assertEquals(toProcessedMetadataKey("imports/a/ho-so"), null);
});

Deno.test("deriveFolderPathFromProcessedKey maps nested processed json to raw folder", () => {
    assertEquals(
        deriveFolderPathFromProcessedKey("processed/batch-1/ho-so-123/ho-so-123.json"),
        "raw/batch-1/ho-so-123",
    );
    assertEquals(
        deriveHoSoIdFromProcessedKey("processed/batch-1/ho-so-123/ho-so-123.json"),
        "ho-so-123",
    );
});

Deno.test("expandKeysWithDocJsonMirrors adds doc_json siblings for raw keys only", () => {
    const keys = new Set([
        "raw/a/ho-so/scan.pdf",
        "raw/a/ho-so/metadata/ocr-result.json",
        "processed/a/ho-so/ho-so.json",
    ]);
    expandKeysWithDocJsonMirrors(keys);
    assertEquals(keys.has("doc_json/a/ho-so/scan.json"), true);
    assertEquals(keys.has("doc_json/a/ho-so/metadata/ocr-result.json"), true);
    assertEquals(keys.has("doc_json/a/ho-so/ho-so.json"), false);
});

Deno.test("isDerivedProcessedMetadataKey detects editor and checker outputs", () => {
    assertEquals(
        isDerivedProcessedMetadataKey("processed/385_CD/385_CD_b845c276_EDITOR.json"),
        true,
    );
    assertEquals(isDerivedProcessedMetadataKey("processed/385_CD/385_CD_EDITOR.json"), true);
    assertEquals(isDerivedProcessedMetadataKey("processed/a/ho-so/ho-so_CHECKER_2.json"), true);
    assertEquals(isDerivedProcessedMetadataKey("processed/a/ho-so/Curated/metadata_update/ho-so_MAKER.json"), true);
    assertEquals(isDerivedProcessedMetadataKey("processed/a/ho-so/ho-so.json"), false);
});

Deno.test("storageDirname and basename parse nested key", () => {
    const key = "imports/2024/ho-so-123/scan.pdf";
    assertEquals(storageDirname(key), "imports/2024/ho-so-123");
    assertEquals(storageBasename(key), "scan.pdf");
    assertEquals(folderNameFromPath(storageDirname(key)), "ho-so-123");
});
