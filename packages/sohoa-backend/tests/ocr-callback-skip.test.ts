import { assertEquals } from "@std/assert";
import { DossierStatus } from "../db/schemas/workflow-constants.ts";
import {
    evaluateOcrCallbackSkip,
    isRepairingDerivedOcrMetadataKey,
    shouldSyncCurrentMetadataKeyOnOcr,
} from "../modules/ocr-callback/ocr-callback-service.ts";

Deno.test("evaluateOcrCallbackSkip ignores derived metadata keys", () => {
    assertEquals(
        evaluateOcrCallbackSkip(
            { ocrMetadataKey: null, status: DossierStatus.NEW },
            "processed/385_CD/385_CD_b845c276_EDITOR.json",
        ),
        "derived_metadata_key",
    );
    assertEquals(
        evaluateOcrCallbackSkip(
            { ocrMetadataKey: "processed/385_CD/385_CD_b845c276.json", status: DossierStatus.WAITING_CHECKER_2 },
            "processed/385_CD/385_CD_b845c276_EDITOR.json",
        ),
        "derived_metadata_key",
    );
});

Deno.test("evaluateOcrCallbackSkip ignores already synced canonical key", () => {
    const output_path = "processed/385_CD/385_CD.json";
    assertEquals(
        evaluateOcrCallbackSkip(
            { ocrMetadataKey: output_path, status: DossierStatus.READY_FOR_ENTRY },
            output_path,
        ),
        "already_synced",
    );
});

Deno.test("evaluateOcrCallbackSkip blocks alternate json when dossier past OCR", () => {
    assertEquals(
        evaluateOcrCallbackSkip(
            {
                ocrMetadataKey: "processed/385_CD/385_CD_b845c276.json",
                status: DossierStatus.WAITING_CHECKER_2,
            },
            "processed/385_CD/385_CD_b845c276_v2.json",
        ),
        "dossier_past_ocr_phase",
    );
});

Deno.test("evaluateOcrCallbackSkip allows first canonical OCR while processing", () => {
    assertEquals(
        evaluateOcrCallbackSkip(
            { ocrMetadataKey: null, status: DossierStatus.OCR_PROCESSING },
            "processed/385_CD/385_CD.json",
        ),
        null,
    );
});

Deno.test("shouldSyncCurrentMetadataKeyOnOcr when no edit yet", () => {
    assertEquals(
        shouldSyncCurrentMetadataKeyOnOcr({ ocrMetadataKey: null, currentMetadataKey: null }),
        true,
    );
    assertEquals(
        shouldSyncCurrentMetadataKeyOnOcr({
            ocrMetadataKey: "processed/a/ho-so.json",
            currentMetadataKey: "processed/a/ho-so.json",
        }),
        true,
    );
});

Deno.test("isRepairingDerivedOcrMetadataKey allows canonical fix after bad ocr key", () => {
    assertEquals(
        isRepairingDerivedOcrMetadataKey(
            { ocrMetadataKey: "processed/385_CD/385_CD_b845c276_EDITOR.json" },
            "processed/385_CD/385_CD_b845c276.json",
        ),
        true,
    );
    assertEquals(
        evaluateOcrCallbackSkip(
            {
                ocrMetadataKey: "processed/385_CD/385_CD_b845c276_EDITOR.json",
                status: DossierStatus.WAITING_CHECKER_2,
            },
            "processed/385_CD/385_CD_b845c276.json",
        ),
        null,
    );
});

Deno.test("shouldSyncCurrentMetadataKeyOnOcr preserves edited currentMetadataKey", () => {
    assertEquals(
        shouldSyncCurrentMetadataKeyOnOcr({
            ocrMetadataKey: "processed/a/ho-so.json",
            currentMetadataKey: "processed/a/ho-so_EDITOR.json",
        }),
        false,
    );
});
