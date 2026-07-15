import { getEsClient } from "./client.ts";
import { indexNameForEntity, SEARCH_ALIAS } from "./config.ts";
import type {
  SearchFieldMatch,
  SearchFilter,
  SearchHit,
  SearchRequest,
  SearchResult,
} from "./types.ts";

function buildFilters(filters?: SearchFilter): Record<string, unknown>[] {
  const clauses: Record<string, unknown>[] = [];
  if (!filters) return clauses;

  if (filters.entityTypes?.length) {
    clauses.push({ terms: { entityType: filters.entityTypes } });
  }
  if (filters.fondIds?.length) {
    clauses.push({ terms: { fondId: filters.fondIds } });
  }
  if (filters.dossierStatus) {
    clauses.push({ term: { dossierStatus: filters.dossierStatus } });
  }
  for (const term of filters.terms ?? []) {
    clauses.push({ term: { [term.field]: term.value } });
  }
  return clauses;
}

function pickFlatSnippet(highlight?: Record<string, string[]>): string {
  const content = highlight?.content?.[0];
  if (content) return content;
  const title = highlight?.title?.[0];
  if (title) return title;
  return "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBbox(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const nums = value.filter((item): item is number =>
    typeof item === "number" && Number.isFinite(item)
  );
  return nums.length >= 4 ? nums.slice(0, 4) : null;
}

function mapInnerHit(innerHit: {
  _source?: unknown;
  highlight?: Record<string, string[]>;
}): SearchFieldMatch {
  const source = asRecord(innerHit._source);
  const highlight =
    innerHit.highlight?.["fields.value"]?.[0] ??
    asString(source.value);

  return {
    groupCode: asString(source.group_code),
    groupName: asString(source.group_name),
    name: asString(source.name),
    display: asString(source.display),
    value: asString(source.value),
    fileName: asNullableString(source.file_name),
    filePath: asNullableString(source.file_path),
    page: asNullableNumber(source.page),
    bbox: asBbox(source.bbox),
    highlight,
  };
}

function extractNestedMatches(hit: {
  inner_hits?: Record<string, { hits?: { hits?: Array<{
    _source?: unknown;
    highlight?: Record<string, string[]>;
  }> } }>;
}): SearchFieldMatch[] {
  const innerHits = hit.inner_hits?.fields?.hits?.hits ?? [];
  return innerHits.map(mapInnerHit);
}

function buildDossierNestedQuery(
  q: string,
  groupCode?: string,
  trangThaiHoSo?: string,
): Record<string, unknown> {
  const nestedMust: Record<string, unknown>[] = [
    {
      match_phrase: {
        "fields.value": {
          query: q,
          slop: 1,
        },
      },
    },
  ];

  if (groupCode?.trim()) {
    nestedMust.unshift({
      term: { "fields.group_code": groupCode.trim() },
    });
  }

  const must: Record<string, unknown>[] = [
    {
      nested: {
        path: "fields",
        query: {
          bool: { must: nestedMust },
        },
        inner_hits: {
          size: 10,
          highlight: {
            fields: {
              "fields.value": {
                type: "fvh",
                pre_tags: ["<mark>"],
                post_tags: ["</mark>"],
              },
            },
          },
        },
      },
    },
  ];

  if (trangThaiHoSo?.trim()) {
    must.unshift({
      term: { "trangThaiHoSo.keyword": trangThaiHoSo.trim() },
    });
  }

  return { bool: { must } };
}

function buildFlatTextQuery(q: string): Record<string, unknown> {
  return {
    bool: {
      must: [
        {
          multi_match: {
            query: q,
            fields: ["title^2", "content"],
            type: "best_fields",
          },
        },
      ],
    },
  };
}

export async function searchDocuments(
  request: SearchRequest,
): Promise<SearchResult> {
  const es = getEsClient();
  if (!es) {
    return { hits: [], total: 0, took: 0 };
  }

  const q = request.q.trim();
  if (!q) {
    return { hits: [], total: 0, took: 0 };
  }

  const from = request.from ?? 0;
  const size = Math.min(request.size ?? 20, 50);
  const filterClauses = buildFilters(request.filters);
  const entityTypes = request.filters?.entityTypes ?? [];
  const isDossierNestedSearch = entityTypes.length === 0 ||
    entityTypes.includes("dossier");

  const baseQuery = isDossierNestedSearch
    ? buildDossierNestedQuery(q, request.groupCode, request.trangThaiHoSo)
    : buildFlatTextQuery(q);

  const boolQuery = baseQuery.bool as Record<string, unknown>;
  boolQuery.filter = filterClauses;

  // Nested `fields` only exists on sohoa_dossier — avoid alias (includes fond).
  const index = isDossierNestedSearch
    ? indexNameForEntity("dossier")
    : SEARCH_ALIAS;

  const searchBody: Record<string, unknown> = {
    index,
    from,
    size,
    track_total_hits: true,
    query: baseQuery,
  };

  if (!isDossierNestedSearch) {
    searchBody.highlight = {
      fields: {
        content: { fragment_size: 150, number_of_fragments: 1 },
        title: { fragment_size: 100, number_of_fragments: 1 },
      },
      pre_tags: ["<em>"],
      post_tags: ["</em>"],
    };
  }

  const response = await es.search(searchBody);

  const hits: SearchHit[] = (response.hits.hits ?? []).map((hit) => {
    const source = asRecord(hit._source);
    const highlight = hit.highlight as Record<string, string[]> | undefined;
    const matches = isDossierNestedSearch
      ? extractNestedMatches(hit as Parameters<typeof extractNestedMatches>[0])
      : [];
    const snippet = matches[0]?.highlight ||
      pickFlatSnippet(highlight) ||
      asString(source.content).slice(0, 150);

    return {
      entityType: asString(source.entityType),
      entityId: asString(source.entityId, String(hit._id ?? "")),
      title: asString(source.title),
      snippet,
      score: hit._score ?? 0,
      fondId: (source.fondId as string | null | undefined) ?? null,
      hoSoId: asNullableString(source.hoSoId),
      trangThaiHoSo: asNullableString(source.trangThaiHoSo),
      matches,
      metadata: (source.metadata as Record<string, unknown> | undefined) ??
        undefined,
    };
  });

  const total = typeof response.hits.total === "number"
    ? response.hits.total
    : response.hits.total?.value ?? 0;

  return {
    hits,
    total,
    took: response.took ?? 0,
  };
}
