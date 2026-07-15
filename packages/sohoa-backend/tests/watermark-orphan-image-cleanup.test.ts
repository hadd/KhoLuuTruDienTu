import { assertEquals } from "@std/assert";
import { shouldCleanupPreviousImageAsset } from "../modules/watermark/watermark-config-service.ts";

Deno.test("shouldCleanupPreviousImageAsset when imageAssetId changed", () => {
  assertEquals(
    shouldCleanupPreviousImageAsset("asset-a", true, "asset-b"),
    true,
  );
});

Deno.test("shouldCleanupPreviousImageAsset when image cleared to null", () => {
  assertEquals(shouldCleanupPreviousImageAsset("asset-a", true, null), true);
});

Deno.test("shouldCleanupPreviousImageAsset skips when same id", () => {
  assertEquals(
    shouldCleanupPreviousImageAsset("asset-a", true, "asset-a"),
    false,
  );
});

Deno.test("shouldCleanupPreviousImageAsset skips when patch omits imageAssetId", () => {
  assertEquals(
    shouldCleanupPreviousImageAsset("asset-a", false, "asset-b"),
    false,
  );
});

Deno.test("shouldCleanupPreviousImageAsset skips when previous was null", () => {
  assertEquals(shouldCleanupPreviousImageAsset(null, true, "asset-b"), false);
});
