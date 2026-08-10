import { httpError } from "@shared/common-lib";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    ARCHIVE_WAREHOUSE_ACCESS_PERMISSIONS,
    hasArchiveWarehousePermission,
} from "../archive/archive-warehouse-permissions.ts";
import { ArchiveWarehouseService } from "../archive/archive-warehouse-service.ts";
import { loadPhysicalPlacementEnrichmentByDossierIds } from "./physical-placement-service.ts";
import { resolvePhysicalWarehouseSearchMode } from "./physical-warehouse-search-mode.ts";
import { dedupePhysicalWarehouseSearchItems } from "./physical-warehouse-search-dedupe.ts";

export type PhysicalWarehouseSearchQuery = {
    q?: string;
    search?: string;
    mode?: string;
    dossierName?: string;
    documentName?: string;
    fondId?: string | Array<string>;
    limit?: string;
    offset?: string;
    groupCode?: string;
    trangThaiHoSo?: string;
    dossierTypeId?: string | Array<string>;
    documentTypeId?: string | Array<string>;
    editorName?: string;
    editCompletedAtFrom?: string;
    editCompletedAtTo?: string;
    archivedAtFrom?: string;
    archivedAtTo?: string;
    searchFields?: string | Array<string>;
};

function checkArchiveWarehouseSearchPermission(profile: UserWithRoles) {
    const allowed = ARCHIVE_WAREHOUSE_ACCESS_PERMISSIONS.some((permission) =>
        hasArchiveWarehousePermission(profile, permission)
    );
    if (!allowed) {
        throw httpError.forbidden(
            `One of these permissions required: ${ARCHIVE_WAREHOUSE_ACCESS_PERMISSIONS.join(", ")}`,
        );
    }
}

function assertPhysicalWarehouseSearchAccess(profile: UserWithRoles) {
    authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_READ);
    checkArchiveWarehouseSearchPermission(profile);
}

function normalizeSearchFields(
    value?: string | Array<string>,
): string | Array<string> | undefined {
    if (!value) return undefined;
    return value;
}

function buildSearchInput(urlQuery: PhysicalWarehouseSearchQuery) {
    const q = urlQuery.q ?? urlQuery.search;
    const limit = urlQuery.limit != null ? Number(urlQuery.limit) : undefined;
    const offset = urlQuery.offset != null ? Number(urlQuery.offset) : undefined;

    return {
        q,
        fondId: urlQuery.fondId,
        limit,
        offset,
        groupCode: urlQuery.groupCode,
        trangThaiHoSo: urlQuery.trangThaiHoSo,
        dossierTypeId: urlQuery.dossierTypeId,
        documentTypeId: urlQuery.documentTypeId,
        editorName: urlQuery.editorName,
        editCompletedAtFrom: urlQuery.editCompletedAtFrom,
        editCompletedAtTo: urlQuery.editCompletedAtTo,
        archivedAtFrom: urlQuery.archivedAtFrom,
        archivedAtTo: urlQuery.archivedAtTo,
        searchFields: normalizeSearchFields(urlQuery.searchFields),
        dossierName: urlQuery.dossierName,
        documentName: urlQuery.documentName,
    };
}

export const PhysicalWarehouseSearchService = {
    async search(profile: UserWithRoles, urlQuery: PhysicalWarehouseSearchQuery) {
        assertPhysicalWarehouseSearchAccess(profile);

        const input = buildSearchInput(urlQuery);
        const mode = resolvePhysicalWarehouseSearchMode(urlQuery, input.q);

        let baseResult;
        if (mode === "content") {
            baseResult = await ArchiveWarehouseService.searchContent(profile, {
                q: input.q,
                fondId: input.fondId,
                limit: input.limit,
                offset: input.offset,
                groupCode: input.groupCode,
                trangThaiHoSo: input.trangThaiHoSo,
                dossierTypeId: input.dossierTypeId,
                documentTypeId: input.documentTypeId,
                editorName: input.editorName,
                editCompletedAtFrom: input.editCompletedAtFrom,
                editCompletedAtTo: input.editCompletedAtTo,
                archivedAtFrom: input.archivedAtFrom,
                archivedAtTo: input.archivedAtTo,
                searchFields: input.searchFields,
            });
        } else if (mode === "all") {
            baseResult = await ArchiveWarehouseService.searchUnified(profile, {
                q: input.q,
                fondId: input.fondId,
                limit: input.limit,
                offset: input.offset,
                groupCode: input.groupCode,
                trangThaiHoSo: input.trangThaiHoSo,
                dossierTypeId: input.dossierTypeId,
                documentTypeId: input.documentTypeId,
                editorName: input.editorName,
                editCompletedAtFrom: input.editCompletedAtFrom,
                editCompletedAtTo: input.editCompletedAtTo,
                archivedAtFrom: input.archivedAtFrom,
                archivedAtTo: input.archivedAtTo,
                searchFields: input.searchFields,
            });
        } else {
            baseResult = await ArchiveWarehouseService.searchMetadata(profile, {
                dossierName: input.dossierName ?? input.q,
                documentName: input.documentName,
                fondId: input.fondId,
                dossierTypeId: input.dossierTypeId,
                documentTypeId: input.documentTypeId,
                editorName: input.editorName,
                editCompletedAtFrom: input.editCompletedAtFrom,
                editCompletedAtTo: input.editCompletedAtTo,
                archivedAtFrom: input.archivedAtFrom,
                archivedAtTo: input.archivedAtTo,
                limit: input.limit,
                offset: input.offset,
            });
        }

        const dossierIds = [...new Set(baseResult.items.map((item) => item.entityId))];
        const placementByDossier = await loadPhysicalPlacementEnrichmentByDossierIds(
            dossierIds,
        );

        const withPlacement = baseResult.items.map((item) => ({
            ...item,
            physicalPlacement: placementByDossier.get(item.entityId) ?? null,
        }));
        const uniqueItems = dedupePhysicalWarehouseSearchItems(withPlacement);

        const dedupedTotal = baseResult.total -
            (baseResult.items.length - uniqueItems.length);

        return {
            ...baseResult,
            total: Math.max(dedupedTotal, uniqueItems.length),
            items: uniqueItems,
        };
    },
};
