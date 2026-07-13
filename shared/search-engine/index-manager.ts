import { getEsClient, isSearchEngineEnabled } from "./client.ts";
import {
  indexNameForEntity,
  mappingForEntity,
  SEARCH_ALIAS,
} from "./config.ts";

function buildIndexSettings(): Record<string, unknown> {
  return {
    number_of_shards: 1,
    number_of_replicas: 0,
    refresh_interval: "5s",
    analysis: {
      filter: {
        vi_icu_normalizer: {
          type: "icu_normalizer",
          name: "nfkc_cf",
        },
      },
      analyzer: {
        vi_analyzer: {
          type: "custom",
          tokenizer: "icu_tokenizer",
          filter: ["vi_icu_normalizer", "icu_folding", "lowercase"],
        },
      },
    },
  };
}

async function attachAlias(index: string): Promise<void> {
  const es = getEsClient();
  if (!es) return;

  const aliasExists = await es.indices.existsAlias({ name: SEARCH_ALIAS });
  if (!aliasExists) {
    await es.indices.putAlias({ index, name: SEARCH_ALIAS });
    return;
  }

  const aliasInfo = await es.indices.getAlias({ name: SEARCH_ALIAS });
  if (!(index in aliasInfo)) {
    await es.indices.putAlias({ index, name: SEARCH_ALIAS });
  }
}

export async function ensureIndex(entityType: string): Promise<void> {
  const es = getEsClient();
  if (!es) return;

  const index = indexNameForEntity(entityType);
  const exists = await es.indices.exists({ index });
  if (!exists) {
    await es.indices.create({
      index,
      mappings: mappingForEntity(entityType) as Record<string, unknown>,
      settings: buildIndexSettings(),
    });
  }

  await attachAlias(index);
}

/** Delete and recreate index with current mapping (required after nested/FVH mapping changes). */
export async function recreateIndex(entityType: string): Promise<void> {
  const es = getEsClient();
  if (!es) return;

  const index = indexNameForEntity(entityType);
  const exists = await es.indices.exists({ index });
  if (exists) {
    await es.indices.delete({ index });
  }

  await es.indices.create({
    index,
    mappings: mappingForEntity(entityType) as Record<string, unknown>,
    settings: buildIndexSettings(),
  });
  await attachAlias(index);
}

export async function ensureAllIndices(entityTypes: string[]): Promise<void> {
  if (!isSearchEngineEnabled()) return;
  for (const entityType of entityTypes) {
    await ensureIndex(entityType);
  }
}
