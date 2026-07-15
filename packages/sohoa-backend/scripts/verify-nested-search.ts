/**
 * Smoke-test nested FVH search against a live Elasticsearch.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.elasticsearch.yml up -d --build
 *   ELASTICSEARCH_ENABLED=true ELASTICSEARCH_URL=http://localhost:2005
 *
 * Usage:
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

await indexDocument({
  entityType: "dossier",
  entityId: "00000000-0000-4000-8000-000000000218",
  title: "Hồ sơ 218_CD",
  hoSoId: "218_CD",
  trangThaiHoSo: "Thi hành xong",
  dossierStatus: "ARCHIVED",
  fondId: "fond-demo",
  fields: [
    {
      group_code: "DUONG_SU",
      group_name: "Đương sự",
      file_name: "CD_218_2023_001.pdf",
      file_path: "raw/218_CD/CD_218_2023_001.pdf",
      name: "_1_HO_VA_TEN",
      display: "Họ và tên 1",
      value: "Lê Thị Minh Ánh",
      page: 1,
      bbox: [488.0, 1572.0, 2077.0, 1649.0],
    },
  ],
  metadata: { folderPath: "raw/218_CD" },
});

const es = getEsClient();
await es?.indices.refresh({ index: indexNameForEntity("dossier") });

const result = await searchDocuments({
  q: "Lê Thị Minh Ánh",
  groupCode: "DUONG_SU",
  trangThaiHoSo: "Thi hành xong",
  filters: {
    entityTypes: ["dossier"],
    dossierStatus: "ARCHIVED",
  },
  size: 5,
});

console.log(JSON.stringify(result, null, 2));

const match = result.hits[0]?.matches?.[0];
if (!match?.highlight.includes("<mark>") || match.page !== 1) {
  console.error("Verification failed: expected FVH highlight + page 1");
  Deno.exit(1);
}

console.log("verify-nested-search: OK");
