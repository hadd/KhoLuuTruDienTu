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

export const DEFAULT_DOCUMENT_MAPPING = {
  properties: {
    entityType: { type: "keyword" },
    entityId: { type: "keyword" },
    title: {
      type: "text",
      fields: { keyword: { type: "keyword", ignore_above: 256 } },
    },
    content: { type: "text" },
    fondId: { type: "keyword" },
    projectCode: { type: "keyword" },
    dossierStatus: { type: "keyword" },
    archiveSubmissionId: { type: "keyword" },
    isIndexed: { type: "boolean" },
    indexedAt: { type: "date" },
    acl: {
      properties: {
        fondIds: { type: "keyword" },
        projectCodes: { type: "keyword" },
        assigneeIds: { type: "keyword" },
      },
    },
    metadata: { type: "object", enabled: false },
  },
} as const;
