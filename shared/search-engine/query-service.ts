import { getEsClient } from "./client.ts";
import { SEARCH_ALIAS } from "./config.ts";
import type { SearchFilter, SearchHit, SearchRequest, SearchResult } from "./types.ts";

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

function pickSnippet(highlight?: Record<string, string[]>): string {
  const content = highlight?.content?.[0];
  if (content) return content;
  const title = highlight?.title?.[0];
  if (title) return title;
  return "";
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

  const response = await es.search({
    index: SEARCH_ALIAS,
    from,
    size,
    track_total_hits: true,
    query: {
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
        filter: filterClauses,
      },
    },
    highlight: {
      fields: {
        content: { fragment_size: 150, number_of_fragments: 1 },
        title: { fragment_size: 100, number_of_fragments: 1 },
      },
      pre_tags: ["<em>"],
      post_tags: ["</em>"],
    },
  });

  const hits: SearchHit[] = (response.hits.hits ?? []).map((hit) => {
    const source = hit._source as Record<string, unknown>;
    const highlight = hit.highlight as Record<string, string[]> | undefined;
    return {
      entityType: String(source.entityType ?? ""),
      entityId: String(source.entityId ?? hit._id ?? ""),
      title: String(source.title ?? ""),
      snippet: pickSnippet(highlight) || String(source.content ?? "").slice(0, 150),
      score: hit._score ?? 0,
      fondId: (source.fondId as string | null | undefined) ?? null,
      metadata: (source.metadata as Record<string, unknown> | undefined) ?? undefined,
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
