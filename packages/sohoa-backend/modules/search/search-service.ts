import type { SearchFilter } from "@shared/search-engine";
import { searchDocuments } from "@shared/search-engine";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { ArchiveScopeResolver } from "../archive-permission/archive-scope-resolver.ts";
import { DOSSIER_ENTITY_TYPE } from "./adapters/dossier.adapter.ts";

export type SearchQueryInput = {
    q?: string;
    types?: string;
    limit?: number;
    offset?: number;
    fondId?: string;
    groupCode?: string;
    trangThaiHoSo?: string;
};

function parseTypes(types?: string): string[] {
    if (!types?.trim()) return [DOSSIER_ENTITY_TYPE];
    return types.split(",").map((t) => t.trim()).filter(Boolean);
}

function fondScopeFrom(
    scope: Awaited<ReturnType<typeof ArchiveScopeResolver.resolve>>,
): string[] | null {
    if (scope.mode === "global") return null;
    if (scope.mode === "scoped" || scope.mode === "fond") return scope.fondIds;
    return [];
}

function buildFilters(
    scope: Awaited<ReturnType<typeof ArchiveScopeResolver.resolve>>,
    types: string[],
    fondId?: string,
): SearchFilter {
    const filters: SearchFilter = { entityTypes: types };

    if (types.includes(DOSSIER_ENTITY_TYPE)) {
        filters.dossierStatus = "ARCHIVED";
    }

    if (scope.mode === "scoped" || scope.mode === "fond") {
        const fondIds = fondId
            ? scope.fondIds.filter((id) => id === fondId)
            : scope.fondIds;
        filters.fondIds = fondIds;
        if (scope.mode === "scoped") {
            filters.dossierTypeIds = scope.dossierTypeIds;
        }
    } else if (fondId) {
        filters.fondIds = [fondId];
    }

    return filters;
}

export const SearchService = {
    async search(profile: UserWithRoles, input: SearchQueryInput) {
        const q = input.q?.trim() ?? "";
        const types = parseTypes(input.types);
        const limit = Math.min(input.limit ?? 20, 50);
        const offset = input.offset ?? 0;

        if (!q) {
            return {
                items: [],
                total: 0,
                took_ms: 0,
                fondScope: null,
                note: null,
                message: "Không tìm thấy kết quả phù hợp",
            };
        }

        const scope = await ArchiveScopeResolver.resolve(profile);
        if (scope.mode === "none") {
            return {
                items: [],
                total: 0,
                took_ms: 0,
                fondScope: [],
                note: null,
                message: "Không tìm thấy kết quả phù hợp",
            };
        }

        const filters = buildFilters(scope, types, input.fondId);
        if (filters.fondIds && filters.fondIds.length === 0) {
            return {
                items: [],
                total: 0,
                took_ms: 0,
                fondScope: fondScopeFrom(scope),
                note: null,
                message: "Không tìm thấy kết quả phù hợp",
            };
        }

        const result = await searchDocuments({
            q,
            groupCode: input.groupCode,
            trangThaiHoSo: input.trangThaiHoSo,
            filters,
            from: offset,
            size: limit,
        });

        const items = result.hits.map((hit) => ({
            entityType: hit.entityType,
            entityId: hit.entityId,
            title: hit.title,
            fondId: hit.fondId ?? null,
            hoSoId: hit.hoSoId ?? null,
            trangThaiHoSo: hit.trangThaiHoSo ?? null,
            snippet: hit.snippet,
            score: hit.score,
            matches: hit.matches ?? [],
            metadata: hit.metadata ?? {},
        }));

        return {
            items,
            total: result.total,
            took_ms: result.took,
            fondScope: fondScopeFrom(scope),
            entityTypes: types,
            note: result.total === 0 ? null : null,
            message: result.total === 0 ? "Không tìm thấy kết quả phù hợp" : null,
        };
    },
};
