export { SearchService } from "./search-service.ts";
export { createSearchRouter } from "./search.router.ts";
export {
    buildDossierSearchDocument,
    indexDossierById,
    DOSSIER_ENTITY_TYPE,
} from "./adapters/dossier.adapter.ts";
export { buildFondSearchDocument, indexFondById, FOND_ENTITY_TYPE } from "./adapters/fond.adapter.ts";
export { enqueueDossierIndex, enqueueDossierDelete } from "./search-index-queue.ts";
