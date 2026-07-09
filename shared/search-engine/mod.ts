export { configureSearchEngine, getSearchEngineConfig, SEARCH_ALIAS, indexNameForEntity } from "./config.ts";
export { getEsClient, isSearchEngineEnabled, pingSearchEngine } from "./client.ts";
export { ensureIndex, ensureAllIndices } from "./index-manager.ts";
export { indexDocument, deleteDocument, bulkIndexDocuments } from "./index-service.ts";
export { searchDocuments } from "./query-service.ts";
export { registerAdapter, getAdapter, getRegisteredEntityTypes } from "./registry.ts";
export type {
  SearchAcl,
  SearchDocument,
  SearchFilter,
  SearchRequest,
  SearchHit,
  SearchResult,
  IndexAdapter,
  IndexEvent,
} from "./types.ts";
