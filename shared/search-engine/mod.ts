export {
  configureSearchEngine,
  getSearchEngineConfig,
  SEARCH_ALIAS,
  indexNameForEntity,
  DOSSIER_DOCUMENT_MAPPING,
  DEFAULT_DOCUMENT_MAPPING,
  mappingForEntity,
} from "./config.ts";
export { getEsClient, isSearchEngineEnabled, pingSearchEngine } from "./client.ts";
export { ensureIndex, ensureAllIndices, recreateIndex } from "./index-manager.ts";
export { indexDocument, deleteDocument, bulkIndexDocuments } from "./index-service.ts";
export { searchDocuments } from "./query-service.ts";
export { registerAdapter, getAdapter, getRegisteredEntityTypes } from "./registry.ts";
export type {
  SearchAcl,
  SearchOcrField,
  SearchDocument,
  SearchFilter,
  SearchRequest,
  SearchFieldMatch,
  SearchHit,
  SearchResult,
  IndexAdapter,
  IndexEvent,
} from "./types.ts";
