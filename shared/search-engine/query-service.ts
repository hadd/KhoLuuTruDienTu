import { getEsClient } from "./client.ts";
import { indexNameForEntity, SEARCH_ALIAS } from "./config.ts";
import {
  buildValueShouldClauses,
  parseSearchQuery,
} from "./query-builder.ts";
import type {
  MetadataSearchRequest,
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
  if (filters.dossierTypeIds?.length) {
    clauses.push({ terms: { dossierTypeId: filters.dossierTypeIds } });
  }
  if (filters.documentTypeIds?.length) {
    clauses.push({ terms: { documentTypeIds: filters.documentTypeIds } });
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

const FVH_INNER_HITS = {
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
} as const;

/** Smart nested query: phrase-first ranking, AND match, fuzzy; quoted → phrase only. */
export function buildDossierNestedQuery(
  q: string,
  groupCode?: string,
  trangThaiHoSo?: string,
): Record<string, unknown> {
  const { text, phraseOnly } = parseSearchQuery(q);
  const valueShould = buildValueShouldClauses(text, phraseOnly);

  const nestedBool: Record<string, unknown> = phraseOnly
    ? { must: [...valueShould] }
    : {
      should: valueShould,
      minimum_should_match: 1,
    };

  if (groupCode?.trim()) {
    const groupTerm = { term: { "fields.group_code": groupCode.trim() } };
    if (phraseOnly) {
      (nestedBool.must as Record<string, unknown>[]).unshift(groupTerm);
    } else {
      nestedBool.filter = [groupTerm];
    }
  }

  const must: Record<string, unknown>[] = [
    {
      nested: {
        path: "fields",
        query: { bool: nestedBool },
        inner_hits: FVH_INNER_HITS,
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
  const { text, phraseOnly } = parseSearchQuery(q);

  if (phraseOnly) {
    return {
      bool: {
        must: [
          {
            multi_match: {
              query: text,
              fields: ["title^2", "content"],
              type: "phrase",
              slop: 1,
            },
          },
        ],
      },
    };
  }

  return {
    bool: {
      must: [
        {
          bool: {
            should: [
              {
                multi_match: {
                  query: text,
                  fields: ["title^2", "content"],
                  type: "phrase",
                  slop: 1,
                  boost: 5,
                },
              },
              {
                multi_match: {
                  query: text,
                  fields: ["title^2", "content"],
                  type: "best_fields",
                  operator: "and",
                  boost: 3,
                },
              },
              {
                multi_match: {
                  query: text,
                  fields: ["title^2", "content"],
                  type: "best_fields",
                  fuzziness: "AUTO",
                  prefix_length: 1,
                  boost: 1,
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
      ],
    },
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function buildTextMatchClause(field: string, raw: string): Record<string, unknown> {
  const { text, phraseOnly } = parseSearchQuery(raw);
  if (phraseOnly) {
    return {
      match_phrase: {
        [field]: { query: text, slop: 1 },
      },
    };
  }
  return {
    bool: {
      should: [
        {
          match_phrase: {
            [field]: { query: text, slop: 1, boost: 5 },
          },
        },
        {
          match: {
            [field]: { query: text, operator: "and", boost: 3 },
          },
        },
        {
          match: {
            [field]: {
              query: text,
              fuzziness: "AUTO",
              prefix_length: 1,
              analyzer: "vi_analyzer",
              boost: 1,
            },
          },
        },
      ],
      minimum_should_match: 1,
    },
  };
}

function buildDateRangeClause(
  field: string,
  from?: string,
  to?: string,
): Record<string, unknown> | null {
  const range: Record<string, string> = {};
  if (from?.trim()) range.gte = from.trim();
  if (to?.trim()) {
    // Inclusive end-of-day when only date (YYYY-MM-DD) is provided
    const end = to.trim();
    range.lte = /^\d{4}-\d{2}-\d{2}$/.test(end) ? `${end}T23:59:59.999Z` : end;
  }
  if (Object.keys(range).length === 0) return null;
  return { range: { [field]: range } };
}

function mapHitIdentification(source: Record<string, unknown>): Pick<
  SearchHit,
  | "fondName"
  | "dossierTypeId"
  | "dossierTypeName"
  | "documentTypeIds"
  | "documentTypeNames"
  | "effectiveRetentionPeriodId"
  | "effectiveRetentionPeriodName"
  | "editorId"
  | "editorName"
  | "editCompletedAt"
  | "archivedAt"
  | "fileNames"
> {
  const editorIds = asStringArray(source.editorIds);
  const editorNames = asStringArray(source.editorNames);
  const fileNames = asStringArray(source.fileNames);
  const documentTypeIds = asStringArray(source.documentTypeIds);
  const documentTypeNames = asStringArray(source.documentTypeNames);
  return {
    fondName: asNullableString(source.fondName) ??
      asNullableString(asRecord(source.metadata).fondName),
    dossierTypeId: asNullableString(source.dossierTypeId),
    dossierTypeName: asNullableString(source.dossierTypeName) ??
      asNullableString(asRecord(source.metadata).dossierTypeName),
    documentTypeIds: documentTypeIds.length > 0 ? documentTypeIds : undefined,
    documentTypeNames: documentTypeNames.length > 0 ? documentTypeNames : undefined,
    effectiveRetentionPeriodId: asNullableString(source.effectiveRetentionPeriodId),
    effectiveRetentionPeriodName: asNullableString(source.effectiveRetentionPeriodName),
    editorId: editorIds[0] ?? null,
    editorName: editorNames[0] ?? null,
    editCompletedAt: asNullableString(source.editCompletedAt),
    archivedAt: asNullableString(source.archivedAt),
    fileNames: fileNames.length > 0 ? fileNames : undefined,
  };
}

/**
 * Metadata / identification search for archived dossiers.
 * All provided criteria are AND-ed. Does not require OCR nested query.
 */
export async function searchMetadataDocuments(
  request: MetadataSearchRequest,
): Promise<SearchResult> {
  const es = getEsClient();
  if (!es) {
    return { hits: [], total: 0, took: 0 };
  }

  const from = request.from ?? 0;
  const size = Math.min(request.size ?? 20, 50);
  const must: Record<string, unknown>[] = [];
  const filter = buildFilters({
    entityTypes: request.filters?.entityTypes?.length
      ? request.filters.entityTypes
      : ["dossier"],
    fondIds: request.fondIds?.length
      ? request.fondIds
      : request.filters?.fondIds,
    dossierTypeIds: request.filters?.dossierTypeIds,
    documentTypeIds: request.filters?.documentTypeIds,
    dossierStatus: request.filters?.dossierStatus ?? "ARCHIVED",
    terms: request.filters?.terms,
  });

  if (request.dossierName?.trim()) {
    must.push(buildTextMatchClause("title", request.dossierName));
  }
  if (request.documentName?.trim()) {
    must.push(buildTextMatchClause("fileNames", request.documentName));
  }
  if (request.dossierTypeId?.trim()) {
    filter.push({ term: { dossierTypeId: request.dossierTypeId.trim() } });
  }
  if (request.documentTypeId?.trim()) {
    const docTypeId = request.documentTypeId.trim();
    // AND: dossier có documentTypeId (catalog) HOẶC nested OCR group_code khớp.
    filter.push({
      bool: {
        should: [
          { term: { documentTypeIds: docTypeId } },
          {
            nested: {
              path: "fields",
              query: { term: { "fields.group_code": docTypeId } },
            },
          },
        ],
        minimum_should_match: 1,
      },
    });
  }
  if (request.editorName?.trim()) {
    must.push(buildTextMatchClause("editorNames", request.editorName));
  }

  const editRange = buildDateRangeClause(
    "editCompletedAt",
    request.editCompletedAtFrom,
    request.editCompletedAtTo,
  );
  if (editRange) filter.push(editRange);

  const archivedRange = buildDateRangeClause(
    "archivedAt",
    request.archivedAtFrom,
    request.archivedAtTo,
  );
  if (archivedRange) filter.push(archivedRange);

  const query: Record<string, unknown> = {
    bool: {
      ...(must.length > 0 ? { must } : { must: [{ match_all: {} }] }),
      filter,
    },
  };

  const response = await es.search({
    index: indexNameForEntity("dossier"),
    from,
    size,
    track_total_hits: true,
    query,
    sort: [
      { archivedAt: { order: "desc", unmapped_type: "date" } },
      { _score: { order: "desc" } },
    ],
  });

  const hits: SearchHit[] = (response.hits.hits ?? []).map((hit) => {
    const source = asRecord(hit._source);
    const identity = mapHitIdentification(source);
    return {
      entityType: asString(source.entityType),
      entityId: asString(source.entityId, String(hit._id ?? "")),
      title: asString(source.title),
      snippet: asString(source.title),
      score: hit._score ?? 0,
      fondId: (source.fondId as string | null | undefined) ?? null,
      hoSoId: asNullableString(source.hoSoId),
      trangThaiHoSo: asNullableString(source.trangThaiHoSo),
      matches: [],
      metadata: (source.metadata as Record<string, unknown> | undefined) ??
        undefined,
      ...identity,
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
  if (request.dossierTypeId?.trim()) {
    filterClauses.push({ term: { dossierTypeId: request.dossierTypeId.trim() } });
  }
  if (request.documentTypeId?.trim()) {
    const docTypeId = request.documentTypeId.trim();
    filterClauses.push({
      bool: {
        should: [
          { term: { documentTypeIds: docTypeId } },
          {
            nested: {
              path: "fields",
              query: { term: { "fields.group_code": docTypeId } },
            },
          },
        ],
        minimum_should_match: 1,
      },
    });
  }
  if (request.editorName?.trim()) {
    filterClauses.push({
      match: {
        editorNames: {
          query: request.editorName.trim(),
          operator: "and",
        },
      },
    });
  }
  const editRange = buildDateRangeClause(
    "editCompletedAt",
    request.editCompletedAtFrom,
    request.editCompletedAtTo,
  );
  if (editRange) filterClauses.push(editRange);
  const archivedRange = buildDateRangeClause(
    "archivedAt",
    request.archivedAtFrom,
    request.archivedAtTo,
  );
  if (archivedRange) filterClauses.push(archivedRange);

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
      ...mapHitIdentification(source),
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
