import { assertEquals } from "@std/assert";
import {
    collectDossierStorageKeys,
    setPurgeDossierFromMinIOOverrideForTests,
} from "../modules/dossier/dossier-delete-utils.ts";

Deno.test("collectDossierStorageKeys excludes aip prefix keys", () => {
    const keys = collectDossierStorageKeys(
        {
            ocrMetadataKey: "processed/x/y.json",
            currentMetadataKey: "Curated/metadata_update/x/y_CHECKER_1.json",
            folderPath: "raw/x/y",
        },
        [
            { filePath: "raw/x/y/scan.pdf" },
            { filePath: "aip/raw/x/y/ho_so/ho_so-AIP_hoso.zip" },
        ],
        [{ metadataKey: null }],
    );

    assertEquals(keys.has("aip/raw/x/y/ho_so/ho_so-AIP_hoso.zip"), false);
    assertEquals(keys.has("raw/x/y/scan.pdf"), true);
});

Deno.test("purgeDossierFromMinIO skips protected aip keys via override filter", async () => {
    const deleted: string[] = [];
    setPurgeDossierFromMinIOOverrideForTests(async (explicitKeys) => {
        for (const key of explicitKeys) {
            if (!key.startsWith("aip/")) {
                deleted.push(key);
            }
        }
        return deleted.length;
    });

    try {
        const keys = new Set<string>(["raw/x/a.pdf", "aip/raw/x/y/z.zip"]);
        for (const key of [...keys]) {
            if (key.startsWith("aip/")) keys.delete(key);
        }
        await collectDossierStorageKeys(
            { ocrMetadataKey: null, currentMetadataKey: null, folderPath: "raw/x" },
            [{ filePath: "aip/raw/x/y/z.zip" }],
            [],
        );
        assertEquals(keys.has("aip/raw/x/y/z.zip"), false);
    } finally {
        setPurgeDossierFromMinIOOverrideForTests(null);
    }
});
