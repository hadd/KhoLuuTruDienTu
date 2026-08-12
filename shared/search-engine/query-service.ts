import { getEsClient } from "./client.ts"
import { indexNameForEntity, SEARCH_ALIAS } from "./config.ts"
import { buildValueShouldClauses, parseSearchQuery } from "./query-builder.ts"
import type { MetadataSearchRequest, SearchFieldMatch, SearchFilter, SearchHit, SearchRequest, SearchResult } from "./types.ts"

function buildFilters(filters?: SearchFilter): Record<string, unknown>[] {
  const clauses: Record<string, unknown>[] = []
  if (!filters) return clauses

  if (filters.entityTypes?.length) {
    clauses.push({ terms: { entityType: filters.entityTypes } })
  }
  if (filters.fondIds?.length) {
    clauses.push({ terms: { fondId: filters.fondIds } })
  }
  if (filters.dossierTypeIds?.length) {
    clauses.push({ terms: { dossierTypeId: filters.dossierTypeIds } })
  }
  if (filters.documentTypeIds?.length) {
    clauses.push({ terms: { documentTypeIds: filters.documentTypeIds } })
  }
  if (filters.dossierStatus) {
    clauses.push({ term: { dossierStatus: filters.dossierStatus } })
  }
  for (const term of filters.terms ?? []) {
    clauses.push({ term: { [term.field]: term.value } })
  }
  return clauses
}

function pickFlatSnippet(highlight?: Record<string, string[]>): string {
  const content = highlight?.content?.[0]
  if (content) return content
  const title = highlight?.title?.[0]
  if (title) return title
  return ""
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {}
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asBbox(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const nums = value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
  return nums.length >= 4 ? nums.slice(0, 4) : null
}

function mapInnerHit(innerHit: {
  _source?: unknown
  highlight?: Record<string, string[]>
}): SearchFieldMatch {
  const source = asRecord(innerHit._source)
  const highlight = innerHit.highlight?.["fields.value"]?.[0] ??
    asString(source.value)

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
  }
}

function extractNestedMatches(hit: {
  inner_hits?: Record<string, {
    hits?: {
      hits?: Array<{
        _source?: unknown
        highlight?: Record<string, string[]>
      }>
    }
  }>
}): SearchFieldMatch[] {
  const innerHitsRoot = hit.inner_hits
  if (!innerHitsRoot) return []

  const matches: SearchFieldMatch[] = []
  for (const bucket of Object.values(innerHitsRoot)) {
    const innerHits = bucket?.hits?.hits ?? []
    matches.push(...innerHits.map(mapInnerHit))
  }
  return matches
}

const CATALOG_SEARCH_FIELD_SOURCES: Array<{
  keys: string[]
  sourceField: string
  display: string
  readValues: (source: Record<string, unknown>) => string[]
}> = [
  {
    keys: ["FOND", "MA_PHONG"],
    sourceField: "fondName",
    display: "Phông",
    readValues: (source) => {
      const value = asNullableString(source.fondName)
      return value ? [value] : []
    },
  },
  {
    keys: ["DOSSIER_TYPE", "TEN_LOAI_HO_SO"],
    sourceField: "dossierTypeName",
    display: "Loại hồ sơ",
    readValues: (source) => {
      const value = asNullableString(source.dossierTypeName)
      return value ? [value] : []
    },
  },
  {
    keys: ["DOCUMENT_TYPE", "TEN_LOAI_TAI_LIEU"],
    sourceField: "documentTypeNames",
    display: "Tên loại tài liệu",
    readValues: (source) => asStringArray(source.documentTypeNames),
  },
  {
    keys: ["MA_HO_SO"],
    sourceField: "hoSoId",
    display: "Mã hồ sơ",
    readValues: (source) => {
      const value = asNullableString(source.hoSoId)
      return value ? [value] : []
    },
  },
  {
    keys: ["TIEU_DE_HO_SO"],
    sourceField: "title",
    display: "Tiêu đề hồ sơ",
    readValues: (source) => {
      const value = asString(source.title)
      return value ? [value] : []
    },
  },
  {
    keys: ["TEN_TAI_LIEU"],
    sourceField: "fileNames",
    display: "Tên tài liệu",
    readValues: (source) => asStringArray(source.fileNames),
  },
]

function stripHtmlTags(value: string): string {
  return value.replace(/<\/?(?:mark|em)[^>]*>/gi, "")
}

function normalizeCatalogHighlight(value: string): string {
  return value.replace(/<\/?em>/gi, (tag) => (tag.toLowerCase() === "<em>" ? "<mark>" : "</mark>"))
}

function synthesizeCatalogFieldMatches(
  source: Record<string, unknown>,
  highlight: Record<string, string[]> | undefined,
  searchFields?: string[],
): SearchFieldMatch[] {
  if (!searchFields?.length) return []

  const selected = new Set(searchFields)
  const existing = new Set<string>()
  const matches: SearchFieldMatch[] = []

  for (const config of CATALOG_SEARCH_FIELD_SOURCES) {
    if (!config.keys.some((key) => selected.has(key))) continue

    const fieldKey = config.keys.find((key) => selected.has(key)) ?? config.keys[0]!
    const fragments = highlight?.[config.sourceField] ?? []

    if (fragments.length > 0) {
      for (const fragment of fragments) {
        const value = stripHtmlTags(fragment).trim()
        if (!value) continue
        const dedupeKey = `${fieldKey}:${value}`
        if (existing.has(dedupeKey)) continue
        existing.add(dedupeKey)
        matches.push({
          groupCode: "",
          groupName: "",
          name: fieldKey,
          display: config.display,
          value,
          fileName: null,
          filePath: null,
          page: null,
          bbox: null,
          highlight: normalizeCatalogHighlight(fragment),
        })
      }
      continue
    }

    for (const value of config.readValues(source)) {
      const trimmed = value.trim()
      if (!trimmed) continue
      const dedupeKey = `${fieldKey}:${trimmed}`
      if (existing.has(dedupeKey)) continue
      existing.add(dedupeKey)
      matches.push({
        groupCode: "",
        groupName: "",
        name: fieldKey,
        display: config.display,
        value: trimmed,
        fileName: null,
        filePath: null,
        page: null,
        bbox: null,
        highlight: trimmed,
      })
    }
  }

  return matches
}

function buildUnifiedSearchHighlight(
  searchFields?: string[],
): Record<string, Record<string, unknown>> | undefined {
  if (!searchFields?.length) return undefined

  const fields: Record<string, Record<string, unknown>> = {}
  const addField = (name: string) => {
    fields[name] = {}
  }

  for (const fieldKey of searchFields) {
    switch (fieldKey) {
      case "FOND":
      case "MA_PHONG":
        addField("fondName")
        break
      case "DOSSIER_TYPE":
      case "TEN_LOAI_HO_SO":
        addField("dossierTypeName")
        break
      case "DOCUMENT_TYPE":
      case "TEN_LOAI_TAI_LIEU":
        addField("documentTypeNames")
        break
      case "MA_HO_SO":
        addField("hoSoId")
        break
      case "TIEU_DE_HO_SO":
        addField("title")
        break
      case "TEN_TAI_LIEU":
        addField("fileNames")
        break
      default:
        break
    }
  }

  return Object.keys(fields).length > 0 ? fields : undefined
}

function buildFvhInnerHits(size = 10) {
  return {
    size: Math.min(Math.max(size, 1), 10),
    highlight: {
      fields: {
        "fields.value": {
          type: "fvh",
          pre_tags: ["<mark>"],
          post_tags: ["</mark>"],
        },
      },
    },
  } as const
}

/** Keep nested matches that belong to the selected metadata search fields. */
export function filterMatchesBySearchFields(
  matches: SearchFieldMatch[],
  searchFields?: string[],
): SearchFieldMatch[] {
  if (!searchFields?.length) return matches
  const keys = new Set(searchFields)
  return matches.filter((match) => {
    const compoundKey = match.groupCode && match.name
      ? `${match.groupCode}.${match.name}`
      : match.name
    return keys.has(match.name) || keys.has(compoundKey)
  })
}

const FVH_INNER_HITS = buildFvhInnerHits()

function buildDossierFieldsNestedClause(
  q: string,
  groupCode?: string,
): Record<string, unknown> {
  const { text, phraseOnly } = parseSearchQuery(q)
  const valueShould = buildValueShouldClauses(text, phraseOnly)

  const nestedBool: Record<string, unknown> = phraseOnly ? { must: [...valueShould] } : {
    should: valueShould,
    minimum_should_match: 1,
  }

  if (groupCode?.trim()) {
    const groupTerm = { term: { "fields.group_code": groupCode.trim() } }
    if (phraseOnly) {
      ;(nestedBool.must as Record<string, unknown>[]).unshift(groupTerm)
    } else {
      nestedBool.filter = [groupTerm]
    }
  }

  return {
    nested: {
      path: "fields",
      query: { bool: nestedBool },
      inner_hits: FVH_INNER_HITS,
    },
  }
}

function buildDossierFieldsNestedClauseWithFields(
  q: string,
  searchFields: string[],
): Record<string, unknown> {
  const { text, phraseOnly } = parseSearchQuery(q)
  const valueShould = buildValueShouldClauses(text, phraseOnly)

  const nestedBool: Record<string, unknown> = phraseOnly ? { must: [...valueShould] } : {
    should: valueShould,
    minimum_should_match: 1,
  }

  const fieldShoulds = searchFields.map((fieldKey) => {
    const parts = fieldKey.split(".")
    if (parts.length === 2) {
      return {
        bool: {
          filter: [
            { term: { "fields.group_code": parts[0] } },
            { term: { "fields.name": parts[1] } },
          ],
        },
      }
    }
    return { term: { "fields.name": fieldKey } }
  })

  const fieldClause = { bool: { should: fieldShoulds, minimum_should_match: 1 } }

  if (phraseOnly) {
    ;(nestedBool.must as Record<string, unknown>[]).unshift(fieldClause)
  } else {
    nestedBool.filter = [fieldClause]
  }

  return {
    nested: {
      path: "fields",
      query: { bool: nestedBool },
      inner_hits: buildFvhInnerHits(searchFields.length || 10),
    },
  }
}

/** Smart nested query: phrase-first ranking, AND match, fuzzy; quoted → phrase only. */
export function buildDossierNestedQuery(
  q: string,
  groupCode?: string,
  trangThaiHoSo?: string,
): Record<string, unknown> {
  const must: Record<string, unknown>[] = [
    buildDossierFieldsNestedClause(q, groupCode),
  ]

  if (trangThaiHoSo?.trim()) {
    must.unshift({
      term: { "trangThaiHoSo.keyword": trangThaiHoSo.trim() },
    })
  }

  return { bool: { must } }
}

function buildArchiveDossierFilterClauses(
  request: Pick<
    SearchRequest,
    | "filters"
    | "dossierTypeId"
    | "documentTypeId"
    | "editorName"
    | "editCompletedAtFrom"
    | "editCompletedAtTo"
    | "archivedAtFrom"
    | "archivedAtTo"
    | "trangThaiHoSo"
  >,
): Record<string, unknown>[] {
  const filterClauses = buildFilters(request.filters)

  if (request.dossierTypeId) {
    const dTypeIds = Array.isArray(request.dossierTypeId) ? request.dossierTypeId : [request.dossierTypeId.trim()]
    if (dTypeIds.length > 0) {
      filterClauses.push({ terms: { dossierTypeId: dTypeIds } })
    }
  }

  if (request.documentTypeId) {
    const docTypeIds = Array.isArray(request.documentTypeId) ? request.documentTypeId : [request.documentTypeId.trim()]

    if (docTypeIds.length > 0) {
      filterClauses.push({
        bool: {
          should: [
            { terms: { documentTypeIds: docTypeIds } },
            {
              nested: {
                path: "fields",
                query: { terms: { "fields.group_code": docTypeIds } },
              },
            },
          ],
          minimum_should_match: 1,
        },
      })
    }
  }
  if (request.editorName?.trim()) {
    filterClauses.push({
      match: {
        editorNames: {
          query: request.editorName.trim(),
          operator: "and",
        },
      },
    })
  }
  const editRange = buildDateRangeClause(
    "editCompletedAt",
    request.editCompletedAtFrom,
    request.editCompletedAtTo,
  )
  if (editRange) filterClauses.push(editRange)
  const archivedRange = buildDateRangeClause(
    "archivedAt",
    request.archivedAtFrom,
    request.archivedAtTo,
  )
  if (archivedRange) filterClauses.push(archivedRange)
  if (request.trangThaiHoSo?.trim()) {
    filterClauses.push({
      term: { "trangThaiHoSo.keyword": request.trangThaiHoSo.trim() },
    })
  }
  return filterClauses
}

function mapDossierSearchHit(
  hit: {
    _source?: unknown
    _id?: string
    _score?: number | null
    highlight?: Record<string, string[]>
    inner_hits?: Record<string, {
      hits?: {
        hits?: Array<{
          _source?: unknown
          highlight?: Record<string, string[]>
        }>
      }
    }>
  },
  searchFields?: string[],
): SearchHit {
  const source = asRecord(hit._source)
  const highlight = hit.highlight as Record<string, string[]> | undefined
  const nestedMatches = extractNestedMatches(
    hit as Parameters<typeof extractNestedMatches>[0],
  )
  const catalogMatches = synthesizeCatalogFieldMatches(
    source,
    highlight,
    searchFields,
  )
  const matches = filterMatchesBySearchFields(
    [...nestedMatches, ...catalogMatches],
    searchFields,
  )
  const snippet = matches[0]?.highlight ||
    pickFlatSnippet(highlight) ||
    asString(source.title) ||
    asString(source.content).slice(0, 150)

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
  }
}

function buildFlatTextQuery(q: string): Record<string, unknown> {
  const { text, phraseOnly } = parseSearchQuery(q)

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
    }
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
                  type: "phrase_prefix",
                  max_expansions: 50,
                  boost: 2,
                },
              },
              {
                multi_match: {
                  query: text,
                  fields: ["title^2", "content"],
                  type: "best_fields",
                  fuzziness: "AUTO",
                  prefix_length: 1,
                  analyzer: "vi_analyzer",
                  boost: 1,
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
      ],
    },
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function buildTextMatchClause(field: string, raw: string): Record<string, unknown> {
  const { text, phraseOnly } = parseSearchQuery(raw)

  // For hoSoId, search both the keyword and the text sub-field
  const searchFields = field === "hoSoId" ? ["hoSoId^5", "hoSoId.text"] : [field]

  if (phraseOnly) {
    return {
      multi_match: {
        query: text,
        fields: searchFields,
        type: "phrase",
        slop: 1,
      },
    }
  }
  return {
    bool: {
      should: [
        {
          multi_match: {
            query: text,
            fields: searchFields.map((f) => (f.includes("^") ? f : `${f}^5`)),
            type: "phrase",
            slop: 1,
          },
        },
        {
          multi_match: {
            query: text,
            fields: searchFields.map((f) => (f.includes("^") ? f.replace(/\^5$/, "^3") : `${f}^3`)),
            operator: "and",
          },
        },
        {
          multi_match: {
            query: text,
            fields: searchFields.filter((f) => !f.startsWith("hoSoId^") && f !== "hoSoId").map((f) => f === "hoSoId.text" ? "hoSoId.text^5" : f),
            type: "phrase_prefix",
            max_expansions: 50,
            boost: 2,
          },
        },
        {
          multi_match: {
            query: text,
            fields: searchFields.filter((f) => !f.startsWith("hoSoId^") && f !== "hoSoId").map((f) => f === "hoSoId.text" ? "hoSoId.text^5" : f),
            fuzziness: "AUTO",
            prefix_length: 1,
            analyzer: "vi_analyzer",
          },
        },
      ],
      minimum_should_match: 1,
    },
  }
}

function buildDateRangeClause(
  field: string,
  from?: string,
  to?: string,
): Record<string, unknown> | null {
  const range: Record<string, string> = {}
  if (from?.trim()) range.gte = from.trim()
  if (to?.trim()) {
    // Inclusive end-of-day when only date (YYYY-MM-DD) is provided
    const end = to.trim()
    range.lte = /^\d{4}-\d{2}-\d{2}$/.test(end) ? `${end}T23:59:59.999Z` : end
  }
  if (Object.keys(range).length === 0) return null
  return { range: { [field]: range } }
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
  const editorIds = asStringArray(source.editorIds)
  const editorNames = asStringArray(source.editorNames)
  const fileNames = asStringArray(source.fileNames)
  const documentTypeIds = asStringArray(source.documentTypeIds)
  const documentTypeNames = asStringArray(source.documentTypeNames)
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
  }
}

/**
 * Metadata / identification search for archived dossiers.
 * All provided criteria are AND-ed. Does not require OCR nested query.
 */
export async function searchMetadataDocuments(
  request: MetadataSearchRequest,
): Promise<SearchResult> {
  const es = getEsClient()
  if (!es) {
    return { hits: [], total: 0, took: 0 }
  }

  const from = request.from ?? 0
  const size = Math.min(request.size ?? 20, 50)
  const must: Record<string, unknown>[] = []
  const filter = buildFilters({
    entityTypes: request.filters?.entityTypes?.length ? request.filters.entityTypes : ["dossier"],
    fondIds: request.fondIds?.length ? request.fondIds : request.filters?.fondIds,
    dossierTypeIds: request.filters?.dossierTypeIds,
    documentTypeIds: request.filters?.documentTypeIds,
    dossierStatus: request.filters?.dossierStatus ?? "ARCHIVED",
    terms: request.filters?.terms,
  })

  if (request.dossierName?.trim()) {
    must.push(buildTextMatchClause("title", request.dossierName))
  }
  if (request.documentName?.trim()) {
    must.push(buildTextMatchClause("fileNames", request.documentName))
  }
  if (request.dossierTypeId) {
    const dTypeIds = Array.isArray(request.dossierTypeId) ? request.dossierTypeId : [request.dossierTypeId.trim()]
    if (dTypeIds.length > 0) {
      filter.push({ terms: { dossierTypeId: dTypeIds } })
    }
  }
  if (request.documentTypeId) {
    const docTypeIds = Array.isArray(request.documentTypeId) ? request.documentTypeId : [request.documentTypeId.trim()]

    if (docTypeIds.length > 0) {
      // AND: dossier có documentTypeId (catalog) HOẶC nested OCR group_code khớp.
      filter.push({
        bool: {
          should: [
            { terms: { documentTypeIds: docTypeIds } },
            {
              nested: {
                path: "fields",
                query: { terms: { "fields.group_code": docTypeIds } },
              },
            },
          ],
          minimum_should_match: 1,
        },
      })
    }
  }
  if (request.editorName?.trim()) {
    must.push(buildTextMatchClause("editorNames", request.editorName))
  }

  const editRange = buildDateRangeClause(
    "editCompletedAt",
    request.editCompletedAtFrom,
    request.editCompletedAtTo,
  )
  if (editRange) filter.push(editRange)

  const archivedRange = buildDateRangeClause(
    "archivedAt",
    request.archivedAtFrom,
    request.archivedAtTo,
  )
  if (archivedRange) filter.push(archivedRange)

  const query: Record<string, unknown> = {
    bool: {
      ...(must.length > 0 ? { must } : { must: [{ match_all: {} }] }),
      filter,
    },
  }

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
  })

  const hits: SearchHit[] = (response.hits.hits ?? []).map((hit) => {
    const source = asRecord(hit._source)
    const identity = mapHitIdentification(source)
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
    }
  })

  const total = typeof response.hits.total === "number" ? response.hits.total : response.hits.total?.value ?? 0

  return {
    hits,
    total,
    took: response.took ?? 0,
  }
}

export async function searchDocuments(
  request: SearchRequest,
): Promise<SearchResult> {
  const es = getEsClient()
  if (!es) {
    return { hits: [], total: 0, took: 0 }
  }

  const q = request.q.trim()
  if (!q) {
    return { hits: [], total: 0, took: 0 }
  }

  const from = request.from ?? 0
  const size = Math.min(request.size ?? 20, 50)
  const filterClauses = buildArchiveDossierFilterClauses(request)

  const entityTypes = request.filters?.entityTypes ?? []
  const isDossierNestedSearch = entityTypes.length === 0 ||
    entityTypes.includes("dossier")

  const baseQuery = isDossierNestedSearch ? buildDossierNestedQuery(q, request.groupCode, request.trangThaiHoSo) : buildFlatTextQuery(q)

  const boolQuery = baseQuery.bool as Record<string, unknown>
  boolQuery.filter = filterClauses

  // Nested `fields` only exists on sohoa_dossier — avoid alias (includes fond).
  const index = isDossierNestedSearch ? indexNameForEntity("dossier") : SEARCH_ALIAS

  const searchBody: Record<string, unknown> = {
    index,
    from,
    size,
    track_total_hits: true,
    query: baseQuery,
  }

  if (!isDossierNestedSearch) {
    searchBody.highlight = {
      fields: {
        content: { fragment_size: 150, number_of_fragments: 1 },
        title: { fragment_size: 100, number_of_fragments: 1 },
      },
      pre_tags: ["<em>"],
      post_tags: ["</em>"],
    }
  }

  const response = await es.search(searchBody)

  const hits: SearchHit[] = (response.hits.hits ?? []).map((hit) => {
    if (isDossierNestedSearch) {
      return mapDossierSearchHit(hit, request.searchFields)
    }
    const source = asRecord(hit._source)
    const highlight = hit.highlight as Record<string, string[]> | undefined
    return {
      entityType: asString(source.entityType),
      entityId: asString(source.entityId, String(hit._id ?? "")),
      title: asString(source.title),
      snippet: pickFlatSnippet(highlight) ||
        asString(source.content).slice(0, 150),
      score: hit._score ?? 0,
      fondId: (source.fondId as string | null | undefined) ?? null,
      hoSoId: asNullableString(source.hoSoId),
      trangThaiHoSo: asNullableString(source.trangThaiHoSo),
      matches: [],
      metadata: (source.metadata as Record<string, unknown> | undefined) ??
        undefined,
      ...mapHitIdentification(source),
    }
  })

  const total = typeof response.hits.total === "number" ? response.hits.total : response.hits.total?.value ?? 0

  return {
    hits,
    total,
    took: response.took ?? 0,
  }
}

/**
 * Unified dossier query: title OR nested OCR (minimum_should_match 1).
 * Exported for unit tests.
 */
export function buildUnifiedDossierQuery(
  q: string,
  groupCode?: string,
  filterClauses: Record<string, unknown>[] = [],
  searchFields?: string[],
): Record<string, unknown> {
  let shouldClauses: Record<string, unknown>[] = []

  if (!searchFields || searchFields.length === 0) {
    shouldClauses = [
      buildTextMatchClause("title", q),
      buildDossierFieldsNestedClause(q, groupCode),
    ]
  } else {
    const hasFond = searchFields.includes("FOND") || searchFields.includes("MA_PHONG")
    const hasDossierType = searchFields.includes("DOSSIER_TYPE") || searchFields.includes("TEN_LOAI_HO_SO")
    const hasDocumentType = searchFields.includes("DOCUMENT_TYPE") || searchFields.includes("TEN_LOAI_TAI_LIEU")
    const hasMaHoSo = searchFields.includes("MA_HO_SO")
    const hasTieuDeHoSo = searchFields.includes("TIEU_DE_HO_SO")
    const hasTenTaiLieu = searchFields.includes("TEN_TAI_LIEU")

    const tt05Fields = searchFields.filter(
      (f) =>
        !["FOND", "MA_PHONG", "DOSSIER_TYPE", "TEN_LOAI_HO_SO", "DOCUMENT_TYPE", "TEN_LOAI_TAI_LIEU", "MA_HO_SO", "TIEU_DE_HO_SO", "TEN_TAI_LIEU"].includes(f),
    )

    if (hasFond) {
      shouldClauses.push(buildTextMatchClause("fondName", q))
    }
    if (hasDossierType) {
      shouldClauses.push(buildTextMatchClause("dossierTypeName", q))
    }
    if (hasDocumentType) {
      shouldClauses.push(buildTextMatchClause("documentTypeNames", q))
      shouldClauses.push(buildDossierFieldsNestedClauseWithFields(q, ["TEN_LOAI_TAI_LIEU"]))
    }
    if (hasMaHoSo) {
      shouldClauses.push(buildTextMatchClause("hoSoId", q))
    }
    if (hasTieuDeHoSo) {
      shouldClauses.push(buildTextMatchClause("title", q))
    }
    if (hasTenTaiLieu) {
      shouldClauses.push(buildTextMatchClause("fileNames", q))
    }
    if (tt05Fields.length > 0) {
      shouldClauses.push(buildDossierFieldsNestedClauseWithFields(q, tt05Fields))
    }
  }

  return {
    bool: {
      should: shouldClauses,
      minimum_should_match: 1,
      filter: filterClauses,
    },
  }
}

/**
 * Unified search: dossier title OR nested OCR content (OR), with shared AND filters.
 */
export async function searchUnifiedDocuments(
  request: SearchRequest,
): Promise<SearchResult> {
  const es = getEsClient()
  if (!es) {
    return { hits: [], total: 0, took: 0 }
  }

  const q = request.q.trim()
  if (!q) {
    return { hits: [], total: 0, took: 0 }
  }

  const from = request.from ?? 0
  const size = Math.min(request.size ?? 20, 50)
  const filterClauses = buildArchiveDossierFilterClauses(request)

  const query: Record<string, unknown> = buildUnifiedDossierQuery(
    q,
    request.groupCode,
    filterClauses,
    request.searchFields,
  )

  const highlightFields = buildUnifiedSearchHighlight(request.searchFields)
  const searchBody: Record<string, unknown> = {
    index: indexNameForEntity("dossier"),
    from,
    size,
    track_total_hits: true,
    query,
    sort: [
      { _score: { order: "desc" } },
      { archivedAt: { order: "desc", unmapped_type: "date" } },
    ],
  }
  if (highlightFields) {
    searchBody.highlight = {
      fields: highlightFields,
      pre_tags: ["<mark>"],
      post_tags: ["</mark>"],
    }
  }

  const response = await es.search(searchBody)

  const hits: SearchHit[] = (response.hits.hits ?? []).map((hit) =>
    mapDossierSearchHit(hit, request.searchFields)
  )

  const total = typeof response.hits.total === "number" ? response.hits.total : response.hits.total?.value ?? 0

  return {
    hits,
    total,
    took: response.took ?? 0,
  }
}
