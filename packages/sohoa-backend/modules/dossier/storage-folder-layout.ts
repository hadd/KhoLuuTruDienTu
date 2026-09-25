import { httpError } from "@shared/common-lib";
import { eq, like, or } from "drizzle-orm";
import { storageDirname } from "./dossier-path-utils.ts";

export const MIXED_FOLDER_LAYOUT_MESSAGE =
    "Invalid structure: a folder cannot contain both PDF files and subfolders with PDFs";

export type StorageFolderLayoutState = {
    directFiles: number;
    hasSubfolderContent: boolean;
};

export function getAncestorFolderPaths(folderPath: string): string[] {
    const parts = folderPath.split("/").filter(Boolean);
    const paths: string[] = [];
    for (let i = 1; i <= parts.length; i++) {
        paths.push(parts.slice(0, i).join("/"));
    }
    return paths;
}

export function buildStorageFolderLayout(
    fileKeys: string[],
): Map<string, StorageFolderLayoutState> {
    const layout = new Map<string, StorageFolderLayoutState>();

    function touch(path: string): StorageFolderLayoutState {
        const existing = layout.get(path);
        if (existing) return existing;
        const created = { directFiles: 0, hasSubfolderContent: false };
        layout.set(path, created);
        return created;
    }

    for (const rawKey of fileKeys) {
        const parentPath = storageDirname(rawKey);
        if (!parentPath) continue;

        touch(parentPath).directFiles += 1;

        const parts = parentPath.split("/").filter(Boolean);
        for (let i = 1; i < parts.length; i++) {
            touch(parts.slice(0, i).join("/")).hasSubfolderContent = true;
        }
    }

    return layout;
}

export function mergeStorageFolderLayouts(
    ...layouts: Array<Map<string, StorageFolderLayoutState>>
): Map<string, StorageFolderLayoutState> {
    const merged = new Map<string, StorageFolderLayoutState>();

    for (const layout of layouts) {
        for (const [path, state] of layout) {
            const target = merged.get(path) ?? {
                directFiles: 0,
                hasSubfolderContent: false,
            };
            target.directFiles += state.directFiles;
            target.hasSubfolderContent = target.hasSubfolderContent ||
                state.hasSubfolderContent;
            merged.set(path, target);
        }
    }

    return merged;
}

export function findMixedFolderPaths(
    layout: Map<string, StorageFolderLayoutState>,
    bypassPaths?: Set<string>,
): string[] {
    const mixed: string[] = [];
    for (const [path, state] of layout) {
        if (bypassPaths?.has(path)) continue;
        if (state.directFiles > 0 && state.hasSubfolderContent) {
            mixed.push(path);
        }
    }
    return mixed.sort();
}

export function assertNoMixedStorageFolderLayout(
    layout: Map<string, StorageFolderLayoutState>,
    bypassPaths?: Set<string>,
): void {
    const mixed = findMixedFolderPaths(layout, bypassPaths);
    if (mixed.length > 0) {
        throw httpError.badRequest(
            `${MIXED_FOLDER_LAYOUT_MESSAGE} (${mixed[0]})`,
        );
    }
}

export function getLayoutCheckRoot(parentPath: string): string {
    const ancestors = getAncestorFolderPaths(parentPath);
    if (ancestors.length <= 2) {
        return ancestors[ancestors.length - 1] ?? parentPath;
    }
    return ancestors[ancestors.length - 2]!;
}

export async function loadExistingStorageFileKeysUnderPrefix(
    prefix: string,
): Promise<string[]> {
    const normalized = prefix.replace(/\/+$/, "");
    if (!normalized) return [];

    const { db } = await import("../../db/db-conn.ts");
    const { dossierFiles } = await import("../../db/schemas/dossier-file.ts");
    const { dossiers } = await import("../../db/schemas/dossier.ts");
    const { activeDossierWhere } = await import("./active-query-filters.ts");

    const rows = await db
        .select({ filePath: dossierFiles.filePath })
        .from(dossierFiles)
        .innerJoin(dossiers, eq(dossiers.id, dossierFiles.dossierId))
        .where(activeDossierWhere(
            or(
                like(dossierFiles.filePath, `${normalized}/%`),
            ),
        ));

    return rows.map((row) => row.filePath);
}

export async function assertNoMixedStorageFolderLayoutForKeys(
    incomingKeys: string[],
    options?: {
        existingKeys?: string[];
        excludeKeys?: string[];
    },
): Promise<void> {
    const exclude = new Set(options?.excludeKeys ?? []);
    const existing = (options?.existingKeys ?? []).filter((key) => !exclude.has(key));
    const incoming = incomingKeys.filter((key) => !exclude.has(key));
    const incomingLayout = buildStorageFolderLayout(incoming);
    const layout = mergeStorageFolderLayouts(
        buildStorageFolderLayout(existing),
        incomingLayout,
    );

    const bypassPaths = new Set<string>();
    // Bypass 'raw' only if the incoming push does not add direct files to 'raw'
    if ((incomingLayout.get("raw")?.directFiles ?? 0) === 0) {
        bypassPaths.add("raw");
    }

    assertNoMixedStorageFolderLayout(layout, bypassPaths);
}

export async function assertNoMixedStorageFolderLayoutOnAdd(
    newKey: string,
    excludeKey?: string,
): Promise<void> {
    const parentPath = storageDirname(newKey);
    if (!parentPath) return;

    const queryRoot = getLayoutCheckRoot(parentPath);
    const existingKeys = await loadExistingStorageFileKeysUnderPrefix(queryRoot);
    await assertNoMixedStorageFolderLayoutForKeys(
        [newKey],
        {
            existingKeys,
            excludeKeys: excludeKey ? [excludeKey] : undefined,
        },
    );
}
