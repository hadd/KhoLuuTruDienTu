import { assertEquals } from "@std/assert";
import {
    folderNameFromPath,
    normalizeStorageKey,
    splitFolderSegments,
    storageBasename,
    storageDirname,
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

Deno.test("storageDirname and basename parse nested key", () => {
    const key = "imports/2024/ho-so-123/scan.pdf";
    assertEquals(storageDirname(key), "imports/2024/ho-so-123");
    assertEquals(storageBasename(key), "scan.pdf");
    assertEquals(folderNameFromPath(storageDirname(key)), "ho-so-123");
});
