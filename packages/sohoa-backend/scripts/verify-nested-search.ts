/**
 * Smoke-test nested FVH + smart search (phrase / fuzzy / synonym) against live ES.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.elasticsearch.yml up -d --build
 *   ELASTICSEARCH_ENABLED=true ELASTICSEARCH_URL=http://localhost:2005
 *
 * After analyzer/synonym/mapping changes:
 *   deno task search:reindex   # recreate + reindex from DB
 *   # or this script alone for a self-contained smoke index:
 *   deno task search:verify-nested
 */
import {
  configureSearchEngine,
  getEsClient,
  indexDocument,
  indexNameForEntity,
  isSearchEngineEnabled,
  pingSearchEngine,
  recreateIndex,
  searchDocuments,
} from "@shared/search-engine";
import { env } from "../env.ts";

configureSearchEngine({
  enabled: env.ELASTICSEARCH_ENABLED,
  url: env.ELASTICSEARCH_URL,
});

if (!isSearchEngineEnabled()) {
  console.error("ELASTICSEARCH_ENABLED must be true");
  Deno.exit(1);
}

const ok = await pingSearchEngine();
if (!ok) {
  console.error(`Elasticsearch unavailable at ${env.ELASTICSEARCH_URL}`);
  Deno.exit(1);
}

await recreateIndex("dossier");

const entityId = "00000000-0000-4000-8000-000000000218";

await indexDocument({
  entityType: "dossier",
  entityId,
  title: "Hồ sơ 218_CD",
  hoSoId: "218_CD",
  trangThaiHoSo: "Thi hành xong",
  dossierStatus: "ARCHIVED",
  fondId: "fond-demo",
  fields: [
    {
      file_name: "CD_218_2023_001.pdf",
      file_path: "raw/218_CD/CD_218_2023_001.pdf",
      group_code: "BAN_AN_QUYET_DINH",
      group_name: "Bản án, quyết định",
      name: "CO_QUAN_BAN_HANH",
      display: "Cơ quan ban hành",
      type: "string",
      value: "Tòa án nhân dân tỉnh Phú Thọ",
      page: 1,
      bbox: [487.0, 325.0, 902.0, 399.0],
    },
    {
      file_name: "CD_218_2023_001.pdf",
      file_path: "raw/218_CD/CD_218_2023_001.pdf",
      group_code: "DUONG_SU",
      group_name: "Đương sự",
      name: "_1_HO_VA_TEN",
      display: "Họ và tên 1",
      type: "string",
      value: "Lê Thị Minh Ánh",
      page: 1,
      bbox: [488.0, 1572.0, 2077.0, 1649.0],
    },
    {
      file_name: "CD_218_2023_002.pdf",
      file_path: "raw/218_CD/CD_218_2023_002.pdf",
      group_code: "QUYET_DINH",
      group_name: "Quyết định THA",
      name: "NGUOI_RA_QD",
      display: "Người ra quyết định",
      type: "string",
      value: "Nguyễn Thị Thu Chung",
      page: 1,
      bbox: [305.0, 3214.0, 381.0, 3289.0],
    },
  ],
  metadata: { folderPath: "raw/218_CD" },
});

const es = getEsClient();
await es?.indices.refresh({ index: indexNameForEntity("dossier") });

const baseFilters = {
  entityTypes: ["dossier"],
  dossierStatus: "ARCHIVED",
};

function assertCase(label: string, okCond: boolean, detail?: unknown) {
  if (!okCond) {
    console.error(`FAIL [${label}]`, detail ?? "");
    Deno.exit(1);
  }
  console.info(`OK   [${label}]`);
}

// 1) Phrase exact
{
  const result = await searchDocuments({
    q: "Nguyễn Thị Thu Chung",
    groupCode: "QUYET_DINH",
    trangThaiHoSo: "Thi hành xong",
    filters: baseFilters,
    size: 5,
  });
  const match = result.hits[0]?.matches?.[0];
  assertCase(
    "phrase exact + FVH",
    !!match?.highlight.includes("<mark>") &&
      match.page === 1 &&
      match.groupCode === "QUYET_DINH",
    result,
  );
}

// 2) Quoted ghép từ — chỉ field đúng cụm
{
  const result = await searchDocuments({
    q: '"Lê Thị Minh Ánh"',
    groupCode: "DUONG_SU",
    filters: baseFilters,
    size: 5,
  });
  const match = result.hits[0]?.matches?.[0];
  assertCase(
    "quoted phrase",
    match?.value === "Lê Thị Minh Ánh" && match.groupCode === "DUONG_SU",
    result,
  );
}

// 3) Fuzzy — lệch 1 ký tự / thiếu dấu nhẹ
{
  const result = await searchDocuments({
    q: "Nguyen Thi Thu Chungg",
    groupCode: "QUYET_DINH",
    filters: baseFilters,
    size: 5,
  });
  const match = result.hits[0]?.matches?.[0];
  assertCase(
    "fuzzy typo",
    match?.groupCode === "QUYET_DINH" &&
      (match.value.includes("Nguyễn") || match.highlight.includes("mark")),
    result,
  );
}

// 4) Synonym — TAND ≈ Tòa án nhân dân
{
  const result = await searchDocuments({
    q: "TAND",
    groupCode: "BAN_AN_QUYET_DINH",
    filters: baseFilters,
    size: 5,
  });
  const match = result.hits[0]?.matches?.[0];
  assertCase(
    "synonym TAND",
    !!match?.value.toLowerCase().includes("tòa án") ||
      !!match?.value.toLowerCase().includes("toa an"),
    result,
  );
}

console.log("verify-nested-search: OK (phrase + fuzzy + synonym)");
