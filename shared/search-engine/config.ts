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

export const VI_ANALYZER_SETTINGS = {
  analysis: {
    filter: {
      vi_icu_normalizer: {
        type: "icu_normalizer",
        name: "nfkc_cf",
      },
    },
    analyzer: {
      vi_analyzer: {
        type: "custom",
        tokenizer: "icu_tokenizer",
        filter: ["vi_icu_normalizer", "icu_folding", "lowercase"],
      },
    },
  },
} as const;

const ACL_MAPPING = {
  properties: {
    fondIds: { type: "keyword" },
    projectCodes: { type: "keyword" },
    assigneeIds: { type: "keyword" },
  },
} as const;

/** Mapping for dossier OCR nested search (FVH requires term_vector on fields.value). */
export const DOSSIER_DOCUMENT_MAPPING = {
  properties: {
    entityType: { type: "keyword" },
    entityId: { type: "keyword" },
    title: {
      type: "text",
      fields: { keyword: { type: "keyword", ignore_above: 256 } },
    },
    hoSoId: { type: "keyword" },
    trangThaiHoSo: {
      type: "text",
      fields: { keyword: { type: "keyword", ignore_above: 256 } },
    },
    fields: {
      type: "nested",
      properties: {
        group_code: { type: "keyword" },
        group_name: { type: "keyword" },
        file_name: { type: "keyword" },
        file_path: { type: "keyword" },
        name: { type: "keyword" },
        display: { type: "text", analyzer: "vi_analyzer" },
        value: {
          type: "text",
          analyzer: "vi_analyzer",
          term_vector: "with_positions_offsets",
        },
        page: { type: "integer" },
        bbox: { type: "float" },
      },
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

/** Mapping for fond and other flat full-text entities. */
export const DEFAULT_DOCUMENT_MAPPING = {
  properties: {
    entityType: { type: "keyword" },
    entityId: { type: "keyword" },
    title: {
      type: "text",
      fields: { keyword: { type: "keyword", ignore_above: 256 } },
    },
    content: { type: "text", analyzer: "vi_analyzer" },
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
