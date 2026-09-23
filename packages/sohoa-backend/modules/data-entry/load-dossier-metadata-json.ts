import { AppError, httpError } from "@shared/common-lib";
import {
  METADATA_OUTPUT_STORAGE_PREFIXES,
  getMetadataOutputPrefix,
  normalizeStorageKey,
  storageBasename,
  storageDirname,
  toMetadataOutputKey,
  type MetadataOutputStoragePrefix,
} from "../dossier/dossier-path-utils.ts";
import { isDraftMetadataKey } from "./metadata-storage-keys.ts";

function resolveMetadataJsonKey(rawKey: string): string {
  return rawKey.endsWith(".json") ? rawKey : `${rawKey}.json`;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof AppError && error.status === 404;
}

function metadataNotFoundMessage(dossierName: string, triedKeys: string[]): string {
  const tried = triedKeys.length > 0 ? triedKeys.join(", ") : "none";
  return `Metadata file not found on storage for dossier "${dossierName}" (tried: ${tried})`;
}

export type DownloadJsonFn = (objectKey: string) => Promise<unknown>;

export type SiblingJsonObject = {
  key: string;
  lastModified?: Date | null;
};

export type ListSiblingJsonFn = (
  prefixDir: string,
) => Promise<SiblingJsonObject[]>;

/** Rank lower = preferred. Drafts are last resort. */
export function rankSiblingMetadataKey(key: string): number {
  const normalized = normalizeStorageKey(key);
  if (isDraftMetadataKey(normalized)) return 100;
  const base = storageBasename(normalized);
  if (/_CHECKER_\d+(_A\d+)?\.json$/i.test(base)) return 1;
  if (/_EDITOR(_A\d+)?\.json$/i.test(base)) return 2;
  if (/_[a-f0-9]{8}\.json$/i.test(base)) return 3;
  if (/_SUMMARY_\d+\.json$/i.test(base)) return 4;
  if (/_RESTORED_[a-z0-9]+\.json$/i.test(base)) return 5;
  return 10;
}

export function pickBestSiblingMetadataKey(
  candidates: SiblingJsonObject[],
  options: {
    dossierName: string;
    excludeKeys?: Iterable<string>;
  },
): string | null {
  const exclude = new Set(
    [...(options.excludeKeys ?? [])].map((k) => normalizeStorageKey(k)),
  );
  const name = options.dossierName.trim();
  const namePrefix = `${name}_`;
  const nameExact = `${name}.json`;

  const eligible = candidates
    .map((c) => ({
      key: normalizeStorageKey(c.key),
      lastModified: c.lastModified ? new Date(c.lastModified).getTime() : 0,
    }))
    .filter((c) => {
      if (!c.key.toLowerCase().endsWith(".json")) return false;
      if (exclude.has(c.key)) return false;
      const base = storageBasename(c.key);
      return base === nameExact || base.startsWith(namePrefix);
    });

  if (eligible.length === 0) return null;

  const nonDraft = eligible.filter((c) => !isDraftMetadataKey(c.key));
  const pool = nonDraft.length > 0 ? nonDraft : eligible;

  pool.sort((a, b) => {
    const rankDiff = rankSiblingMetadataKey(a.key) - rankSiblingMetadataKey(b.key);
    if (rankDiff !== 0) return rankDiff;
    return b.lastModified - a.lastModified;
  });

  return pool[0]?.key ?? null;
}

function deriveFolderMetadataKeys(
  folderPath: string | null | undefined,
  preferredPrefix: MetadataOutputStoragePrefix | null,
): string[] {
  const path = folderPath?.trim();
  if (!path) return [];

  const prefixes: MetadataOutputStoragePrefix[] = preferredPrefix
    ? [
      preferredPrefix,
      ...METADATA_OUTPUT_STORAGE_PREFIXES.filter((p) => p !== preferredPrefix),
    ]
    : [...METADATA_OUTPUT_STORAGE_PREFIXES];

  const keys: string[] = [];
  for (const prefix of prefixes) {
    const key = toMetadataOutputKey(path, prefix);
    if (key) keys.push(resolveMetadataJsonKey(key));
  }
  return keys;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (!raw) continue;
    const value = normalizeStorageKey(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function uniqueKeys(keys: Array<string | null | undefined>): string[] {
  return uniqueStrings(
    keys.map((raw) => (raw ? resolveMetadataJsonKey(raw) : null)),
  );
}

export type ResolveMetadataKeyInput = {
  dossierName: string;
  currentMetadataKey: string | null | undefined;
  ocrMetadataKey?: string | null;
  folderPath?: string | null;
};

function buildPrimaryMetadataKeys(input: ResolveMetadataKeyInput): {
  currentKey: string | null;
  ocrKey: string | null;
  folderKeys: string[];
  primaryKeys: string[];
} {
  const currentRaw = input.currentMetadataKey?.trim() || null;
  const ocrRaw = input.ocrMetadataKey?.trim() || null;
  const currentKey = currentRaw ? resolveMetadataJsonKey(currentRaw) : null;
  const ocrKey = ocrRaw ? resolveMetadataJsonKey(ocrRaw) : null;

  const preferredPrefix =
    getMetadataOutputPrefix(currentKey ?? ocrKey ?? "") ?? null;
  const folderKeys = deriveFolderMetadataKeys(input.folderPath, preferredPrefix);
  const primaryKeys = uniqueKeys([currentKey, ocrKey, ...folderKeys]);

  return { currentKey, ocrKey, folderKeys, primaryKeys };
}

/**
 * Resolve a metadata object key that exists on storage for UI/export URLs.
 * Prefer current → OCR → folder-derived canonical keys when present in the
 * prefix listing; otherwise pick the best sibling (partial / editor / draft).
 * Falls back to the preferred DB key when listing is unavailable.
 */
export async function resolveReadableMetadataStorageKey(
  input: ResolveMetadataKeyInput,
  options?: {
    listSiblingJsonKeys?: ListSiblingJsonFn;
  },
): Promise<string | null> {
  const { currentKey, ocrKey, folderKeys, primaryKeys } =
    buildPrimaryMetadataKeys(input);
  const preferredKey = currentKey ?? ocrKey ?? primaryKeys[0] ?? null;
  const listSiblingJsonKeys = options?.listSiblingJsonKeys;

  if (!listSiblingJsonKeys) {
    return preferredKey;
  }

  const dirs = uniqueStrings([
    currentKey ? storageDirname(currentKey) : null,
    ocrKey ? storageDirname(ocrKey) : null,
    ...folderKeys.map((k) => storageDirname(k)),
  ]);

  const listedByKey = new Map<string, SiblingJsonObject>();
  for (const dir of dirs) {
    try {
      const siblings = await listSiblingJsonKeys(
        dir.endsWith("/") ? dir : `${dir}/`,
      );
      for (const sibling of siblings) {
        const key = normalizeStorageKey(sibling.key);
        if (!key.toLowerCase().endsWith(".json")) continue;
        if (!listedByKey.has(key)) {
          listedByKey.set(key, { key, lastModified: sibling.lastModified });
        }
      }
    } catch (err) {
      console.warn(
        `[MetadataResolve] failed listing siblings under "${dir}" for dossier "${input.dossierName}":`,
        err,
      );
    }
  }

  if (listedByKey.size === 0) {
    return preferredKey;
  }

  for (const key of primaryKeys) {
    if (listedByKey.has(key)) {
      if (preferredKey && key !== preferredKey) {
        console.warn(
          `[MetadataResolve] using fallback metadata key for dossier "${input.dossierName}": ${key}` +
            ` (preferred missing: ${preferredKey})`,
        );
      }
      return key;
    }
  }

  const siblingKey = pickBestSiblingMetadataKey([...listedByKey.values()], {
    dossierName: input.dossierName,
  });
  if (siblingKey) {
    console.warn(
      `[MetadataResolve] using sibling metadata key for dossier "${input.dossierName}": ${siblingKey}` +
        (preferredKey ? ` (preferred missing: ${preferredKey})` : ""),
    );
    return siblingKey;
  }

  return preferredKey;
}

/**
 * Load dossier metadata JSON for export/read.
 * Prefer currentMetadataKey; on storage 404 fall back to ocrMetadataKey,
 * then folderPath-derived canonical key, then newest sibling JSON under the same prefix.
 */
export async function loadDossierMetadataJsonFromStorage(
  input: ResolveMetadataKeyInput,
  downloadJson: DownloadJsonFn,
  options?: {
    listSiblingJsonKeys?: ListSiblingJsonFn;
  },
): Promise<unknown> {
  const { currentKey, ocrKey, folderKeys, primaryKeys } =
    buildPrimaryMetadataKeys(input);
  const preferredKey = currentKey ?? ocrKey;
  const triedKeys: string[] = [];

  for (const key of primaryKeys) {
    triedKeys.push(key);
    try {
      const data = await downloadJson(key);
      if (preferredKey && key !== preferredKey) {
        console.warn(
          `[MetadataExport] using fallback metadata key for dossier "${input.dossierName}": ${key}` +
            ` (preferred missing: ${preferredKey})`,
        );
      } else if (!preferredKey && key !== primaryKeys[0]) {
        console.warn(
          `[MetadataExport] using fallback metadata key for dossier "${input.dossierName}": ${key}`,
        );
      }
      return data;
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  const listSiblingJsonKeys = options?.listSiblingJsonKeys;
  if (listSiblingJsonKeys) {
    const dirs = uniqueStrings([
      currentKey ? storageDirname(currentKey) : null,
      ocrKey ? storageDirname(ocrKey) : null,
      ...folderKeys.map((k) => storageDirname(k)),
    ]);

    for (const dir of dirs) {
      let siblings: SiblingJsonObject[] = [];
      try {
        siblings = await listSiblingJsonKeys(dir.endsWith("/") ? dir : `${dir}/`);
      } catch (err) {
        console.warn(
          `[MetadataExport] failed listing siblings under "${dir}" for dossier "${input.dossierName}":`,
          err,
        );
        continue;
      }

      const siblingKey = pickBestSiblingMetadataKey(siblings, {
        dossierName: input.dossierName,
        excludeKeys: triedKeys,
      });
      if (!siblingKey) continue;

      triedKeys.push(siblingKey);
      try {
        const data = await downloadJson(siblingKey);
        console.warn(
          `[MetadataExport] using sibling metadata key for dossier "${input.dossierName}": ${siblingKey}` +
            (currentKey ? ` (currentMetadataKey missing: ${currentKey})` : ""),
        );
        return data;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }
    }
  }

  throw httpError.notFound(
    metadataNotFoundMessage(input.dossierName, triedKeys),
  );
}
