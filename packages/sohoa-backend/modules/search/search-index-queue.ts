import { logApi } from "@shared/common-lib";
import { indexDossierById } from "./adapters/dossier.adapter.ts";

export function enqueueDossierIndex(dossierId: string): void {
    indexDossierById(dossierId).catch((err) => {
        logApi.error({ err, dossierId }, "[SearchIndex] Failed to index dossier");
    });
}

export function enqueueDossierDelete(dossierId: string): void {
    import("@shared/search-engine").then(({ deleteDocument }) =>
        deleteDocument("dossier", dossierId)
    ).catch((err) => {
        logApi.error({ err, dossierId }, "[SearchIndex] Failed to delete dossier from index");
    });
}
