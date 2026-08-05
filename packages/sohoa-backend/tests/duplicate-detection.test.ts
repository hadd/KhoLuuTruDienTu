import { assertEquals } from "@std/assert";
import { detectDuplicateMatches } from "../libs/duplicate-detection.ts";
import { DuplicateDetectionRuleKey } from "../db/schemas/archive-disposal-constants.ts";

Deno.test("detectDuplicateMatches groups dossiers by normalized name", () => {
    const matches = detectDuplicateMatches(
        [
            { dossierId: "a", dossierName: "Hồ sơ A" },
            { dossierId: "b", dossierName: "Ho so A" },
            { dossierId: "c", dossierName: "Khác" },
        ],
        new Set([DuplicateDetectionRuleKey.DOSSIER_NAME]),
        null,
    );

    const matchA = matches.get("dossier:a");
    const matchB = matches.get("dossier:b");
    assertEquals(Boolean(matchA), true);
    assertEquals(Boolean(matchB), true);
    assertEquals(matchA?.duplicateGroupId, matchB?.duplicateGroupId);
    assertEquals(matchA?.duplicatePeerCount, 1);
    assertEquals(matches.has("dossier:c"), false);
});

Deno.test("detectDuplicateMatches groups files by name and size", () => {
    const matches = detectDuplicateMatches(
        [
            {
                dossierId: "a",
                fileId: "f1",
                dossierName: "HS1",
                fileName: "doc.pdf",
                fileSizeKb: 100,
            },
            {
                dossierId: "b",
                fileId: "f2",
                dossierName: "HS2",
                fileName: "doc.pdf",
                fileSizeKb: 100,
            },
        ],
        new Set([DuplicateDetectionRuleKey.FILE_NAME_SIZE]),
        null,
    );

    assertEquals(matches.get("file:f1")?.duplicatePeerCount, 1);
    assertEquals(matches.get("file:f2")?.duplicatePeerCount, 1);
});
