import { getEsClient, isSearchEngineEnabled } from "./client.ts";
import {
  DEFAULT_DOCUMENT_MAPPING,
  indexNameForEntity,
  SEARCH_ALIAS,
} from "./config.ts";

export async function ensureIndex(entityType: string): Promise<void> {
  const es = getEsClient();
  if (!es) return;

  const index = indexNameForEntity(entityType);
  const exists = await es.indices.exists({ index });
  if (!exists) {
    await es.indices.create({
      index,
      mappings: DEFAULT_DOCUMENT_MAPPING,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        refresh_interval: "5s",
      },
    });
  }

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

export async function ensureAllIndices(entityTypes: string[]): Promise<void> {
  if (!isSearchEngineEnabled()) return;
  for (const entityType of entityTypes) {
    await ensureIndex(entityType);
  }
}
