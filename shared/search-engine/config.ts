import { VI_LEGAL_SYNONYMS } from "./synonyms.ts";

export type SearchEngineConfig = {
  enabled: boolean;
  url: string;
};

let config: SearchEngineConfig = {
  enabled: false,
  url: "http://localhost:9200",
};

export function configureSearchEngine(next: SearchEngineConfig): void {
  config = next;
}

export function getSearchEngineConfig(): SearchEngineConfig {
  return config;
}

export const SEARCH_ALIAS = "sohoa_search";

export function indexNameForEntity(entityType: string): string {
  return `sohoa_${entityType}`;
}

/** Shared index analysis: index analyzer (no synonym) + search analyzer (synonym). */
export const VI_ANALYZER_SETTINGS = {
  analysis: {
    filter: {
      vi_icu_normalizer: {
        type: "icu_normalizer",
        name: "nfkc_cf",
      },
      vi_synonym: {
        type: "synonym_graph",
        synonyms: VI_LEGAL_SYNONYMS,
        expand: true,
      },
    },
    analyzer: {
      vi_analyzer: {
        type: "custom",
        tokenizer: "icu_tokenizer",
        filter: ["vi_icu_normalizer", "icu_folding", "lowercase"],
      },
      vi_search_analyzer: {
        type: "custom",
        tokenizer: "icu_tokenizer",
        filter: [
          "vi_icu_normalizer",
          "icu_folding",
          "lowercase",
          "vi_synonym",
        ],
      },
    },
  },
} as const;

export function buildIndexSettings(): Record<string, unknown> {
  return {
    number_of_shards: 1,
    number_of_replicas: 0,
    refresh_interval: "5s",
    ...VI_ANALYZER_SETTINGS,
  };
}

const ACL_MAPPING = {
  properties: {
    fondIds: { type: "keyword" },
    projectCodes: { type: "keyword" },
    assigneeIds: { type: "keyword" },
  },
} as const;

/**
 * Mapping hồ sơ sau khi phẳng hóa OCR:
 * metadata_groups[] → fields[] (mỗi phần tử mang file + group + field).
 * FVH yêu cầu term_vector trên fields.value.
 */
export const DOSSIER_DOCUMENT_MAPPING = {
  properties: {
    entityType: { type: "keyword" },
    entityId: { type: "keyword" },
    title: {
      type: "text",
      fields: { keyword: { type: "keyword", ignore_above: 256 } },
    },
    /** Tương đương ho_so_id trong JSON OCR phẳng. */
    hoSoId: { type: "keyword" },
    /** Tương đương trang_thai_ho_so trong JSON OCR phẳng. */
    trangThaiHoSo: {
      type: "text",
      fields: { keyword: { type: "keyword", ignore_above: 256 } },
    },
    fields: {
      type: "nested",
      properties: {
        file_name: { type: "keyword" },
        file_path: { type: "keyword" },
        group_code: { type: "keyword" },
        group_name: {
          type: "text",
          analyzer: "vi_analyzer",
          search_analyzer: "vi_search_analyzer",
          fields: { keyword: { type: "keyword", ignore_above: 256 } },
        },
        name: { type: "keyword" },
        display: {
          type: "text",
          analyzer: "vi_analyzer",
          search_analyzer: "vi_search_analyzer",
          fields: { keyword: { type: "keyword", ignore_above: 256 } },
        },
        type: { type: "keyword" },
        value: {
          type: "text",
          analyzer: "vi_analyzer",
          search_analyzer: "vi_search_analyzer",
          term_vector: "with_positions_offsets",
        },
        page: { type: "integer" },
        /** [x1, y1, x2, y2] — ES float nhận mảng số. */
        bbox: { type: "float" },
      },
    },
    fondId: { type: "keyword" },
    dossierTypeId: { type: "keyword" },
    projectCode: { type: "keyword" },
    dossierStatus: { type: "keyword" },
    archiveSubmissionId: { type: "keyword" },
    isIndexed: { type: "boolean" },
    indexedAt: { type: "date" },
    acl: ACL_MAPPING,
    metadata: { type: "object", enabled: false },
  },
} as const;

/** Mapping for fond and other flat full-text entities. */
export const DEFAULT_DOCUMENT_MAPPING = {
  properties: {
    entityType: { type: "keyword" },
    entityId: { type: "keyword" },
    title: {
      type: "text",
      fields: { keyword: { type: "keyword", ignore_above: 256 } },
    },
    content: {
      type: "text",
      analyzer: "vi_analyzer",
      search_analyzer: "vi_search_analyzer",
    },
    fondId: { type: "keyword" },
    projectCode: { type: "keyword" },
    dossierStatus: { type: "keyword" },
    archiveSubmissionId: { type: "keyword" },
    isIndexed: { type: "boolean" },
    indexedAt: { type: "date" },
    acl: ACL_MAPPING,
    metadata: { type: "object", enabled: false },
  },
} as const;

export function mappingForEntity(entityType: string) {
  return entityType === "dossier"
    ? DOSSIER_DOCUMENT_MAPPING
    : DEFAULT_DOCUMENT_MAPPING;
}
