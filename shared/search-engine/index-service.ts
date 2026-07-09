import { getEsClient } from "./client.ts";
import { ensureIndex } from "./index-manager.ts";
import { indexNameForEntity } from "./config.ts";
import type { SearchDocument } from "./types.ts";

function docId(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export async function indexDocument(doc: SearchDocument): Promise<void> {
  const es = getEsClient();
  if (!es) return;

  await ensureIndex(doc.entityType);
  const index = indexNameForEntity(doc.entityType);
  const body = {
    ...doc,
    isIndexed: true,
    indexedAt: new Date().toISOString(),
  };

  await es.index({
    index,
    id: docId(doc.entityType, doc.entityId),
    document: body,
    refresh: false,
  });
}

export async function deleteDocument(
  entityType: string,
  entityId: string,
): Promise<void> {
  const es = getEsClient();
  if (!es) return;

  const index = indexNameForEntity(entityType);
  try {
    await es.delete({
      index,
      id: docId(entityType, entityId),
      refresh: false,
    });
  } catch (error) {
    const status = (error as { meta?: { statusCode?: number } })?.meta?.statusCode;
    if (status === 404) return;
    throw error;
  }
}

export async function bulkIndexDocuments(docs: SearchDocument[]): Promise<{
  indexed: number;
  failed: number;
}> {
  const es = getEsClient();
  if (!es || docs.length === 0) {
    return { indexed: 0, failed: docs.length };
  }

  const byType = new Map<string, SearchDocument[]>();
  for (const doc of docs) {
    const list = byType.get(doc.entityType) ?? [];
    list.push(doc);
    byType.set(doc.entityType, list);
  }

  let indexed = 0;
  let failed = 0;

  for (const [entityType, group] of byType) {
    await ensureIndex(entityType);
    const index = indexNameForEntity(entityType);
    const operations = group.flatMap((doc) => [
      { index: { _index: index, _id: docId(doc.entityType, doc.entityId) } },
      { ...doc, isIndexed: true, indexedAt: new Date().toISOString() },
    ]);

    const result = await es.bulk({ operations, refresh: false });
    if (result.errors) {
      for (const item of result.items ?? []) {
        const op = item.index ?? item.create ?? item.update;
        if (op?.error) failed += 1;
        else indexed += 1;
      }
    } else {
      indexed += group.length;
    }
  }

  return { indexed, failed };
}
