import { assertEquals, assertRejects } from "@std/assert";
import { AppError, httpError } from "@shared/common-lib";
import {
  loadDossierMetadataJsonFromStorage,
  pickBestSiblingMetadataKey,
  resolveReadableMetadataStorageKey,
} from "../modules/data-entry/load-dossier-metadata-json.ts";

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
  "loadDossierMetadataJsonFromStorage falls back to folderPath-derived key",
  async () => {
    const calls: string[] = [];
    const result = await loadDossierMetadataJsonFromStorage(
      {
        dossierName: "0001",
        currentMetadataKey:
          "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_CHECKER_1.json",
        ocrMetadataKey:
          "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001.json",
        folderPath: "raw/CSDL_SOHOA_TUTQ/028.23.02/01/0001",
      },
      async (key) => {
        calls.push(key);
        if (
          key ===
            "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.02/01/0001/0001.json"
        ) {
          return { ...SAMPLE, source: "folder" };
        }
        throw httpError.notFound("Metadata file not found on storage");
      },
    );

    assertEquals((result as { source?: string }).source, "folder");
    assertEquals(
      calls.includes(
        "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.02/01/0001/0001.json",
      ),
      true,
    );
  },
);

Deno.test(
  "loadDossierMetadataJsonFromStorage falls back to non-draft sibling before draft",
  async () => {
    const listedDirs: string[] = [];
    const result = await loadDossierMetadataJsonFromStorage(
      {
        dossierName: "0001",
        currentMetadataKey:
          "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_CHECKER_1.json",
        ocrMetadataKey:
          "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001.json",
      },
      async (key) => {
        if (
          key ===
            "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_30efd0e4.json"
        ) {
          return { ...SAMPLE, source: "partial" };
        }
        throw httpError.notFound("Metadata file not found on storage");
      },
      {
        listSiblingJsonKeys: async (prefixDir) => {
          listedDirs.push(prefixDir);
          return [
            {
              key:
                "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_CHECKER_1_DRAFT_b885e614.json",
              lastModified: new Date("2026-09-23T10:00:00Z"),
            },
            {
              key:
                "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_30efd0e4.json",
              lastModified: new Date("2026-09-22T10:00:00Z"),
            },
            {
              key:
                "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_3390c63c.json",
              lastModified: new Date("2026-09-21T10:00:00Z"),
            },
          ];
        },
      },
    );

    assertEquals((result as { source?: string }).source, "partial");
    assertEquals(
      listedDirs[0],
      "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/",
    );
  },
);

Deno.test(
  "pickBestSiblingMetadataKey prefers CHECKER over hex partial and draft",
  () => {
    const picked = pickBestSiblingMetadataKey(
      [
        {
          key: "folder/0001_CHECKER_1_DRAFT_abc.json",
          lastModified: new Date("2026-09-23T12:00:00Z"),
        },
        {
          key: "folder/0001_30efd0e4.json",
          lastModified: new Date("2026-09-23T11:00:00Z"),
        },
        {
          key: "folder/0001_CHECKER_1.json",
          lastModified: new Date("2026-09-20T10:00:00Z"),
        },
      ],
      { dossierName: "0001" },
    );
    assertEquals(picked, "folder/0001_CHECKER_1.json");
  },
);

Deno.test(
  "pickBestSiblingMetadataKey uses draft only when no other siblings exist",
  () => {
    const picked = pickBestSiblingMetadataKey(
      [
        {
          key: "folder/0001_CHECKER_1_DRAFT_b885e614.json",
          lastModified: new Date("2026-09-23T12:00:00Z"),
        },
      ],
      { dossierName: "0001" },
    );
    assertEquals(picked, "folder/0001_CHECKER_1_DRAFT_b885e614.json");
  },
);

Deno.test(
  "loadDossierMetadataJsonFromStorage 404 includes dossier name and all tried keys when both missing",
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
      'Metadata file not found on storage for dossier "HS-01" (tried: tt05_metadata/batch/HS-01_EDITOR.json, tt05_metadata/batch/HS-01.json)',
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
      'Metadata file not found on storage for dossier "HS-02" (tried: processed/a/b.json)',
    );
  },
);

Deno.test(
  "resolveReadableMetadataStorageKey returns preferred key when listing is omitted",
  async () => {
    const key = await resolveReadableMetadataStorageKey({
      dossierName: "0001",
      currentMetadataKey:
        "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_EDITOR.json",
      ocrMetadataKey:
        "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001.json",
    });
    assertEquals(
      key,
      "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_EDITOR.json",
    );
  },
);

Deno.test(
  "resolveReadableMetadataStorageKey prefers listed primary key over siblings",
  async () => {
    const key = await resolveReadableMetadataStorageKey(
      {
        dossierName: "0001",
        currentMetadataKey:
          "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_EDITOR.json",
        ocrMetadataKey:
          "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001.json",
      },
      {
        listSiblingJsonKeys: async () => [
          {
            key:
              "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_30efd0e4.json",
            lastModified: new Date("2026-09-23T10:00:00Z"),
          },
          {
            key:
              "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001.json",
            lastModified: new Date("2026-09-20T10:00:00Z"),
          },
        ],
      },
    );
    assertEquals(
      key,
      "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001.json",
    );
  },
);

Deno.test(
  "resolveReadableMetadataStorageKey falls back to newest hex partial when canonical keys missing",
  async () => {
    const key = await resolveReadableMetadataStorageKey(
      {
        dossierName: "0001",
        currentMetadataKey:
          "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_CHECKER_1.json",
        ocrMetadataKey:
          "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001.json",
        folderPath: "raw/CSDL_SOHOA_TUTQ/028.23.05/01/0001",
      },
      {
        listSiblingJsonKeys: async () => [
          {
            key:
              "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_CHECKER_1_DRAFT_b885e614.json",
            lastModified: new Date("2026-09-23T10:00:00Z"),
          },
          {
            key:
              "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_30efd0e4.json",
            lastModified: new Date("2026-09-22T14:43:00Z"),
          },
          {
            key:
              "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_3390c63c.json",
            lastModified: new Date("2026-09-23T10:05:00Z"),
          },
        ],
      },
    );
    assertEquals(
      key,
      "tuyen_quang_metadata/CSDL_SOHOA_TUTQ/028.23.05/01/0001/0001_3390c63c.json",
    );
  },
);
