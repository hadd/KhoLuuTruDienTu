export {
  configureSearchEngine,
  getSearchEngineConfig,
  SEARCH_ALIAS,
  indexNameForEntity,
  DOSSIER_DOCUMENT_MAPPING,
  DEFAULT_DOCUMENT_MAPPING,
  mappingForEntity,
  buildIndexSettings,
  VI_ANALYZER_SETTINGS,
} from "./config.ts";
export { VI_LEGAL_SYNONYMS } from "./synonyms.ts";
export { getEsClient, isSearchEngineEnabled, pingSearchEngine } from "./client.ts";
export { ensureIndex, ensureAllIndices, recreateIndex } from "./index-manager.ts";
export { indexDocument, deleteDocument, bulkIndexDocuments } from "./index-service.ts";
export {
  searchDocuments,
  searchMetadataDocuments,
  searchUnifiedDocuments,
  buildDossierNestedQuery,
  buildUnifiedDossierQuery,
  filterMatchesBySearchFields,
} from "./query-service.ts";
export {
  parseSearchQuery,
  buildValueShouldClauses,
} from "./query-builder.ts";
export { registerAdapter, getAdapter, getRegisteredEntityTypes } from "./registry.ts";
export type {
  SearchAcl,
  SearchOcrField,
  SearchDocument,
  SearchFilter,
  SearchRequest,
  MetadataSearchRequest,
  SearchFieldMatch,
  SearchHit,
  SearchResult,
  IndexAdapter,
  IndexEvent,
} from "./types.ts";
