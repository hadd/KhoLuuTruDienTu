import { assertEquals, assertMatch } from "@std/assert";
import { buildSummaryMetadataUpdateKey } from "../modules/data-entry/metadata-storage-keys.ts";

Deno.test("buildSummaryMetadataUpdateKey writes under Curated/metadata_update with SUMMARY stamp", () => {
    const key = buildSummaryMetadataUpdateKey("Curated/metadata/ho_so/185.json");
    assertMatch(key, /Curated\/metadata_update\/ho_so\/185_SUMMARY_\d+\.json$/);
});

Deno.test("buildSummaryMetadataUpdateKey strips prior SUMMARY suffix before stamping", () => {
    const first = buildSummaryMetadataUpdateKey("raw/metadata/ho_so.json");
    const second = buildSummaryMetadataUpdateKey(first);
    assertMatch(first, /185|ho_so|SUMMARY/);
    assertMatch(second, /SUMMARY_\d+\.json$/);
    assertEquals(first.includes("_SUMMARY_"), true);
});
