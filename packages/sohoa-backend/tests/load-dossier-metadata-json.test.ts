import { assertEquals, assertRejects } from "@std/assert";
import { AppError, httpError } from "@shared/common-lib";
import { loadDossierMetadataJsonFromStorage } from "../modules/data-entry/load-dossier-metadata-json.ts";

const SAMPLE = {
  ho_so_id: "HS-01",
  metadata_groups: [],
};

Deno.test("loadDossierMetadataJsonFromStorage uses currentMetadataKey when present", async () => {
  const calls: string[] = [];
  const result = await loadDossierMetadataJsonFromStorage(
    {
      dossierName: "HS-01",
      currentMetadataKey: "tt05_metadata/batch/HS-01_EDITOR.json",
      ocrMetadataKey: "tt05_metadata/batch/HS-01.json",
    },
    async (key) => {
      calls.push(key);
      assertEquals(key, "tt05_metadata/batch/HS-01_EDITOR.json");
      return SAMPLE;
    },
  );

  assertEquals(result, SAMPLE);
  assertEquals(calls, ["tt05_metadata/batch/HS-01_EDITOR.json"]);
});

Deno.test(
  "loadDossierMetadataJsonFromStorage falls back to ocrMetadataKey when current is 404",
  async () => {
    const calls: string[] = [];
    const result = await loadDossierMetadataJsonFromStorage(
      {
        dossierName: "HS-01",
        currentMetadataKey: "tt05_metadata/batch/HS-01_EDITOR",
        ocrMetadataKey: "tt05_metadata/batch/HS-01.json",
      },
      async (key) => {
        calls.push(key);
        if (key === "tt05_metadata/batch/HS-01_EDITOR.json") {
          throw httpError.notFound("Metadata file not found on storage");
        }
        return { ...SAMPLE, source: "ocr" };
      },
    );

    assertEquals((result as { source?: string }).source, "ocr");
    assertEquals(calls, [
      "tt05_metadata/batch/HS-01_EDITOR.json",
      "tt05_metadata/batch/HS-01.json",
    ]);
  },
);

Deno.test(
  "loadDossierMetadataJsonFromStorage 404 includes dossier name and current key when both missing",
  async () => {
    const error = await assertRejects(
      () =>
        loadDossierMetadataJsonFromStorage(
          {
            dossierName: "HS-01",
            currentMetadataKey: "tt05_metadata/batch/HS-01_EDITOR.json",
            ocrMetadataKey: "tt05_metadata/batch/HS-01.json",
          },
          async () => {
            throw httpError.notFound("Metadata file not found on storage");
          },
        ),
      AppError,
    );

    assertEquals(error.status, 404);
    assertEquals(
      error.message,
      'Metadata file not found on storage for dossier "HS-01" (key: tt05_metadata/batch/HS-01_EDITOR.json)',
    );
  },
);

Deno.test(
  "loadDossierMetadataJsonFromStorage 404 includes dossier name when only current key exists and is missing",
  async () => {
    const error = await assertRejects(
      () =>
        loadDossierMetadataJsonFromStorage(
          {
            dossierName: "HS-02",
            currentMetadataKey: "processed/a/b.json",
            ocrMetadataKey: null,
          },
          async () => {
            throw httpError.notFound("Metadata file not found on storage");
          },
        ),
      AppError,
    );

    assertEquals(error.status, 404);
    assertEquals(
      error.message,
      'Metadata file not found on storage for dossier "HS-02" (key: processed/a/b.json)',
    );
  },
);
