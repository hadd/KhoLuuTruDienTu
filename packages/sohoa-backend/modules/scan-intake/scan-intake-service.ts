import { httpError } from "@shared/common-lib";
import type { Static } from "elysia";
import { PDFDocument } from "pdf-lib";
import { ProjectService } from "../project/project-service.ts";
import { DossierService } from "../dossier/dossier-service.ts";
import { storageBasename, normalizeStorageKey } from "../dossier/dossier-path-utils.ts";
import {
    assertNoMixedStorageFolderLayoutForKeys,
    loadExistingStorageFileKeysUnderPrefix,
} from "../dossier/storage-folder-layout.ts";
import {
    buildLinkGet,
    downloadBinaryFromStorage,
} from "../data-entry/data-entry-s3-utils.ts";
import { getS3Client } from "../../libs/s3.ts";
import {
    assertSafePathSegment,
    buildDocumentPdfKey,
    buildInboxDocumentPdfFileName,
    isInboxPdfUploadFileName,
    isLegacyInboxPdfFileName,
    parseInboxPdfRelative,
    resolvePromotePdfFileName,
    sanitizeInboxLabelToPdfBase,
    buildInboxDocPrefix,
    buildPageKey,
    buildSessionPrefix,
    assertScanDraftKey,
    resolveDraftScope,
    SCAN_DRAFT_PREFIX,
} from "./scan-intake-path-utils.ts";
import {
    copyStorageObject,
    copyToRawPrefix,
    deleteKeysUnderPrefix,
    deleteStorageObject,
    listKeysUnderPrefix,
    resolveS3Bucket,
    uploadBinaryToStorage,
} from "./scan-intake-s3-utils.ts";
import type {
    assemblePdfBodySchema,
    deletePageBodySchema,
    deletePagesBodySchema,
    deleteDocumentBodySchema,
    deleteSessionBodySchema,
    listSessionQuerySchema,
    organizeMoveBodySchema,
    organizeRenameFolderBodySchema,
    organizeRenamePdfBodySchema,
    presignedGetBodySchema,
    promoteBodySchema,
    reorderPagesBodySchema,
    uploadPointBodySchema,
} from "./types.ts";

import { env } from "../../env.ts";

const DEFAULT_EXPIRY = 3600;

function resolveRawStoragePrefix(): string {
    return env.STORAGE_RAW_PREFIX ?? "raw";
}

function sanitizeOrganizeFolderSegment(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throw httpError.badRequest("Folder name is required");
    }
    const slug = trimmed
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 120);
    return assertSafePathSegment(slug || "untitled", "folderName");
}

function buildRenamedOrganizePath(folderPath: string, newName: string): string {
    const parent = folderPath.includes("/")
        ? folderPath.slice(0, folderPath.lastIndexOf("/"))
        : "";
    const segment = sanitizeOrganizeFolderSegment(newName);
    return parent ? `${parent}/${segment}` : segment;
}

function sanitizeOrganizePdfFileName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throw httpError.badRequest("PDF name is required");
    }
    return assertSafePathSegment(
        sanitizeInboxLabelToPdfBase(trimmed),
        "pdfName",
    );
}

function normalizeTargetRawFolderPath(targetFolderPath: string): string {
    const rawPrefix = resolveRawStoragePrefix();
    const normalized = normalizeStorageKey(targetFolderPath).replace(/\/+$/, "");
    if (normalized !== rawPrefix && !normalized.startsWith(`${rawPrefix}/`)) {
        throw httpError.badRequest(
            `Target folder must be under ${rawPrefix}/`,
        );
    }
    return normalized;
}

function buildPromoteRawKey(
    targetFolder: string,
    draftFolderPath: string,
    pdfName: string,
): string {
    const safePdfName = storageBasename(pdfName);
    if (!safePdfName || safePdfName.includes("/")) {
        throw httpError.badRequest("Invalid pdf name");
    }

    const parts = [targetFolder];
    const cleanDraftPath = draftFolderPath.startsWith("organize/")
        ? draftFolderPath.slice("organize/".length)
        : draftFolderPath;

    if (cleanDraftPath) {
        for (const segment of cleanDraftPath.split("/").filter(Boolean)) {
            parts.push(assertSafePathSegment(segment, "folderPath"));
        }
    }
    parts.push(safePdfName);
    return parts.join("/");
}

function isDraftFolderUnderOrganizeRoot(
    draftFolderPath: string,
    organizeFolderPath: string,
): boolean {
    const root = organizeFolderPath.replace(/\/+$/, "");
    if (!root) return true;
    return draftFolderPath === root || draftFolderPath.startsWith(`${root}/`);
}

export interface ScanIntakePageInfo {
    key: string;
    fileName: string;
    sortOrder: number;
}

export interface ScanIntakeInboxDoc {
    docSlug: string;
    displayName: string;
    pages: ScanIntakePageInfo[];
    pdfKey: string | null;
    pageCount: number;
}

export interface ScanIntakeFolderPdf {
    name: string;
    key: string;
}

export interface ScanIntakeFolder {
    /** Relative path under session (may contain `/` for nested folders). */
    folderPath: string;
    pdfs: ScanIntakeFolderPdf[];
}

function isOrganizeTempSegment(segment: string): boolean {
    return segment.startsWith("_reorder");
}

async function deleteStaleInboxPdfs(
    docPrefix: string,
    keepKey: string,
): Promise<void> {
    const keys = await listKeysUnderPrefix(docPrefix);
    for (const key of keys) {
        const relative = key.slice(docPrefix.length);
        if (
            relative.toLowerCase().endsWith(".pdf") &&
            !relative.includes("/") &&
            key !== keepKey
        ) {
            try {
                await deleteStorageObject(key);
            } catch {
                // Stale PDF may already be gone.
            }
        }
    }
}

function parseOrganizePdfRelative(
    parts: string[],
): { folderPath: string; fileName: string } | null {
    if (parts.length < 2 || parts[0] === "inbox") return null;
    if (parts.some(isOrganizeTempSegment)) return null;

    const fileName = parts[parts.length - 1]!;
    if (!fileName.endsWith(".pdf")) return null;

    const folderPath = parts.slice(0, -1).join("/");
    if (!folderPath) return null;

    return { folderPath, fileName };
}

export interface ScanIntakeSessionListItem {
    sessionId: string;
    updatedAt: string | null;
    inboxDocCount: number;
    folderCount: number;
}

export const ScanIntakeService = {
    async createUploadPoint(input: Static<typeof uploadPointBodySchema>) {
        const scope = resolveDraftScope();
        const s3 = await getS3Client();
        if (!s3) {
            throw httpError.serviceUnavailable("S3 is not configured");
        }

        const sessionId = assertSafePathSegment(input.sessionId, "sessionId");
        const docSlug = input.docSlug
            ? assertSafePathSegment(input.docSlug, "docSlug")
            : null;

        const fileName = input.fileName.replace(/^\/+/, "");
        if (fileName.includes("..") || fileName.includes("\\")) {
            throw httpError.badRequest("Invalid file name");
        }

        let objectKey: string;
        if (docSlug && fileName.match(/^\d{3}\.jpg$/i)) {
            objectKey = buildPageKey(scope, sessionId, docSlug, fileName);
        } else if (docSlug && isInboxPdfUploadFileName(docSlug, fileName)) {
            objectKey = buildDocumentPdfKey(scope, sessionId, docSlug);
        } else if (docSlug) {
            objectKey = `${buildInboxDocPrefix(scope, sessionId, docSlug)}${fileName}`;
        } else {
            objectKey = `${buildSessionPrefix(scope, sessionId)}${fileName}`;
        }

        assertScanDraftKey(objectKey);

        const bucket = resolveS3Bucket();
        const uploadUrl = await s3.generatePresignedUrl({
            bucket,
            objectName: objectKey,
            method: "PUT",
            expiry: input.expiry ?? DEFAULT_EXPIRY,
        });

        return {
            bucket,
            key: objectKey,
            uploadUrl,
            sessionId,
        };
    },

    async createPresignedGet(input: Static<typeof presignedGetBodySchema>) {
        const key = assertScanDraftKey(input.key);
        const url = await buildLinkGet(key, {
            expirySeconds: input.expiry ?? DEFAULT_EXPIRY,
        });
        if (!url) {
            throw httpError.serviceUnavailable("S3 is not configured");
        }
        return { key, url };
    },

    async listSessions() {
        const scope = resolveDraftScope();
        const prefix = `${SCAN_DRAFT_PREFIX}/${scope}/`;
        const keys = await listKeysUnderPrefix(prefix);

        const sessionMap = new Map<string, { inboxDocs: Set<string>; folders: Set<string> }>();

        for (const key of keys) {
            const relative = key.slice(prefix.length);
            const parts = relative.split("/").filter(Boolean);
            if (parts.length < 1) continue;

            const sessionId = parts[0]!;
            if (!sessionMap.has(sessionId)) {
                sessionMap.set(sessionId, {
                    inboxDocs: new Set(),
                    folders: new Set(),
                });
            }
            const entry = sessionMap.get(sessionId)!;

            if (parts[1] === "inbox" && parts[2]) {
                entry.inboxDocs.add(parts[2]);
            } else {
                const organized = parseOrganizePdfRelative(parts.slice(1));
                if (organized) {
                    entry.folders.add(organized.folderPath);
                }
            }
        }

        const sessions: ScanIntakeSessionListItem[] = [];
        for (const [sessionId, data] of sessionMap) {
            sessions.push({
                sessionId,
                updatedAt: null,
                inboxDocCount: data.inboxDocs.size,
                folderCount: data.folders.size,
            });
        }

        return { sessions };
    },

    async listSession(input: Static<typeof listSessionQuerySchema>) {
        const scope = resolveDraftScope();
        const sessionPrefix = buildSessionPrefix(scope, input.sessionId);
        const keys = await listKeysUnderPrefix(sessionPrefix);

        const inboxDocs = new Map<string, ScanIntakeInboxDoc>();
        const folderPdfs = new Map<string, ScanIntakeFolderPdf[]>();

        for (const key of keys) {
            const relative = key.slice(sessionPrefix.length);
            const parts = relative.split("/").filter(Boolean);
            if (parts.length === 0) continue;

            if (parts[0] === "inbox" && parts.length >= 2) {
                const docSlug = parts[1]!;
                if (!inboxDocs.has(docSlug)) {
                    inboxDocs.set(docSlug, {
                        docSlug,
                        displayName: docSlug.replace(/_/g, " "),
                        pages: [],
                        pdfKey: null,
                        pageCount: 0,
                    });
                }
                const doc = inboxDocs.get(docSlug)!;

                if (parts[2] === "pages" && parts[3]?.match(/^\d{3}\.jpg$/i)) {
                    const fileName = parts[3];
                    const sortOrder = parseInt(fileName.slice(0, 3), 10);
                    doc.pages.push({ key, fileName, sortOrder });
                } else if (
                    parts[2]?.endsWith(".pdf") &&
                    parts.length === 3
                ) {
                    const canonicalKey = buildDocumentPdfKey(
                        scope,
                        input.sessionId,
                        docSlug,
                    );
                    if (key === canonicalKey) {
                        doc.pdfKey = key;
                    } else if (!isLegacyInboxPdfFileName(parts[2]!)) {
                        doc.pdfKey = key;
                        doc.displayName = parts[2]!
                            .replace(/\.pdf$/i, "")
                            .replace(/_/g, " ");
                    } else if (!doc.pdfKey) {
                        doc.pdfKey = key;
                    }
                }
            } else {
                const organized = parseOrganizePdfRelative(parts);
                if (organized) {
                    const { folderPath, fileName } = organized;
                    if (!folderPdfs.has(folderPath)) {
                        folderPdfs.set(folderPath, []);
                    }
                    const displayName = isLegacyInboxPdfFileName(fileName)
                        ? `${folderPath.split("/").pop() ?? "untitled"}.pdf`
                        : fileName;
                    folderPdfs.get(folderPath)!.push({ name: displayName, key });
                }
            }
        }

        for (const doc of inboxDocs.values()) {
            doc.pages.sort((a, b) => a.sortOrder - b.sortOrder);
            doc.pageCount = doc.pages.length;
            const pdfKeyCandidate = buildDocumentPdfKey(
                scope,
                input.sessionId,
                doc.docSlug,
            );
            if (keys.includes(pdfKeyCandidate)) {
                doc.pdfKey = pdfKeyCandidate;
            }
        }

        const inbox = [...inboxDocs.values()].sort((a, b) =>
            a.docSlug.localeCompare(b.docSlug),
        );

        const folders: ScanIntakeFolder[] = [...folderPdfs.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([folderPath, pdfs]) => ({
                folderPath,
                pdfs: pdfs.sort((a, b) => a.name.localeCompare(b.name)),
            }));

        return {
            sessionId: input.sessionId,
            inbox,
            folders,
        };
    },

    async assemblePdf(input: Static<typeof assemblePdfBodySchema>) {
        const scope = resolveDraftScope();
        const docPrefix = buildInboxDocPrefix(scope, input.sessionId, input.docSlug);
        const pagePrefix = `${docPrefix}pages/`;
        const keys = await listKeysUnderPrefix(pagePrefix);
        const pageKeys = keys
            .filter((k) => /\/\d{3}\.jpg$/i.test(k))
            .sort((a, b) => {
                const aNum = parseInt(storageBasename(a).slice(0, 3), 10);
                const bNum = parseInt(storageBasename(b).slice(0, 3), 10);
                return aNum - bNum;
            });

        if (pageKeys.length === 0) {
            throw httpError.badRequest("No page images found to assemble");
        }

        const pdfDoc = await PDFDocument.create();

        for (const pageKey of pageKeys) {
            const jpegBytes = await downloadBinaryFromStorage(pageKey);
            const image = await pdfDoc.embedJpg(jpegBytes);
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        }

        const pdfBytes = await pdfDoc.save();
        const pdfKey = buildDocumentPdfKey(
            scope,
            input.sessionId,
            input.docSlug,
            input.displayName,
        );

        await uploadBinaryToStorage(pdfKey, pdfBytes, "application/pdf");
        await deleteStaleInboxPdfs(docPrefix, pdfKey);

        const url = await buildLinkGet(pdfKey);
        return {
            pdfKey,
            pageCount: pageKeys.length,
            url,
        };
    },

    async reorderPages(input: Static<typeof reorderPagesBodySchema>) {
        const scope = resolveDraftScope();
        const docPrefix = buildInboxDocPrefix(scope, input.sessionId, input.docSlug);
        const pagePrefix = `${docPrefix}pages/`;

        const orderedKeys = input.pageKeys.map((k) => assertScanDraftKey(k));

        for (const key of orderedKeys) {
            if (!key.startsWith(pagePrefix)) {
                throw httpError.badRequest("All page keys must belong to the document");
            }
        }

        // Temp folder must NOT live under pages/ — listKeysUnderPrefix(pagePrefix) is recursive
        // and would include temp copies, then delete them before restore.
        const tempPrefix = `${docPrefix}_reorder_${crypto.randomUUID()}/`;
        const tempKeys: string[] = [];

        try {
            for (let i = 0; i < orderedKeys.length; i++) {
                const tempKey = `${tempPrefix}${String(i + 1).padStart(3, "0")}.jpg`;
                await copyStorageObject(orderedKeys[i]!, tempKey);
                tempKeys.push(tempKey);
            }

            const existingKeys = await listKeysUnderPrefix(pagePrefix);
            for (const key of existingKeys) {
                const relative = key.slice(pagePrefix.length);
                if (!relative.includes("/") && /^\d{3}\.jpg$/i.test(relative)) {
                    await deleteStorageObject(key);
                }
            }

            const finalKeys: string[] = [];
            for (let i = 0; i < tempKeys.length; i++) {
                const finalName = `${String(i + 1).padStart(3, "0")}.jpg`;
                const finalKey = `${pagePrefix}${finalName}`;
                await copyStorageObject(tempKeys[i]!, finalKey);
                finalKeys.push(finalKey);
            }

            return { pageKeys: finalKeys };
        } finally {
            await deleteKeysUnderPrefix(tempPrefix);
        }
    },

    async deletePage(input: Static<typeof deletePageBodySchema>) {
        const key = assertScanDraftKey(input.key);
        if (!/\/\d{3}\.jpg$/i.test(key)) {
            throw httpError.badRequest("Key must be a page image");
        }
        await deleteStorageObject(key);
        return { deleted: true, key };
    },

    async deletePages(input: Static<typeof deletePagesBodySchema>) {
        const keys = input.keys.map((k) => assertScanDraftKey(k));
        for (const key of keys) {
            if (!/\/\d{3}\.jpg$/i.test(key)) {
                throw httpError.badRequest("All keys must be page images");
            }
        }
        for (const key of keys) {
            await deleteStorageObject(key);
        }
        return { deleted: true, count: keys.length };
    },

    async deleteDocument(input: Static<typeof deleteDocumentBodySchema>) {
        const scope = resolveDraftScope();
        const docPrefix = buildInboxDocPrefix(scope, input.sessionId, input.docSlug);
        const deleted = await deleteKeysUnderPrefix(docPrefix);
        return { deleted: true, objectCount: deleted };
    },

    async organizeMove(input: Static<typeof organizeMoveBodySchema>) {
        const scope = resolveDraftScope();
        const sessionPrefix = buildSessionPrefix(scope, input.sessionId);
        const sourceKey = assertScanDraftKey(input.sourceKey);
        const destKey = assertScanDraftKey(input.destKey);

        if (!sourceKey.startsWith(sessionPrefix) || !destKey.startsWith(sessionPrefix)) {
            throw httpError.badRequest("Keys must belong to the session");
        }

        if (!sourceKey.endsWith(".pdf") || !destKey.endsWith(".pdf")) {
            throw httpError.badRequest("Only PDF files can be moved in organize step");
        }

        const destRelative = destKey.slice(sessionPrefix.length);
        const destRelativeParts = destRelative.split("/");
        if (destRelativeParts.some(isOrganizeTempSegment)) {
            throw httpError.badRequest("Invalid organize destination");
        }

        const isInboxDest = parseInboxPdfRelative(destRelativeParts) !== null;
        const isOrganizeDest = !destRelative.startsWith("inbox/");

        if (!isInboxDest && !isOrganizeDest) {
            throw httpError.badRequest("Invalid organize destination");
        }

        await copyStorageObject(sourceKey, destKey);
        await deleteStorageObject(sourceKey);

        return { sourceKey, destKey };
    },

    async organizeRenameFolder(input: Static<typeof organizeRenameFolderBodySchema>) {
        const scope = resolveDraftScope();
        const sessionPrefix = buildSessionPrefix(scope, input.sessionId);
        const oldPath = input.folderPath.trim();
        if (!oldPath || oldPath.includes("..")) {
            throw httpError.badRequest("Invalid folder path");
        }

        const newPath = buildRenamedOrganizePath(oldPath, input.newName);
        if (oldPath === newPath) {
            return { folderPath: newPath, renamed: 0 };
        }

        const keys = await listKeysUnderPrefix(`${sessionPrefix}${oldPath}/`);
        const pdfKeys = keys.filter((key) => key.endsWith(".pdf"));

        for (const key of pdfKeys) {
            const relative = key.slice(sessionPrefix.length);
            const suffix = relative.slice(oldPath.length);
            const destRelative = `${newPath}${suffix}`;
            const destKey = `${sessionPrefix}${destRelative}`;
            await copyStorageObject(key, destKey);
            await deleteStorageObject(key);
        }

        return { folderPath: newPath, renamed: pdfKeys.length };
    },

    async organizeRenamePdf(input: Static<typeof organizeRenamePdfBodySchema>) {
        const scope = resolveDraftScope();
        const sessionPrefix = buildSessionPrefix(scope, input.sessionId);
        const sourceKey = assertScanDraftKey(input.pdfKey);

        if (!sourceKey.startsWith(sessionPrefix)) {
            throw httpError.badRequest("PDF must belong to the session");
        }
        if (!sourceKey.endsWith(".pdf")) {
            throw httpError.badRequest("Key must be a PDF file");
        }

        const relative = sourceKey.slice(sessionPrefix.length);
        const parts = relative.split("/").filter(Boolean);
        const newFileName = `${sanitizeOrganizePdfFileName(input.newName)}.pdf`;

        let destKey: string;
        const inbox = parseInboxPdfRelative(parts);
        if (inbox) {
            destKey = `${sessionPrefix}inbox/${inbox.docSlug}/${newFileName}`;
        } else {
            const organized = parseOrganizePdfRelative(parts);
            if (!organized) {
                throw httpError.badRequest("Invalid PDF location");
            }
            destKey = `${sessionPrefix}${organized.folderPath}/${newFileName}`;
        }

        if (sourceKey === destKey) {
            return { pdfKey: destKey, renamed: false };
        }

        const parentPrefix = destKey.slice(0, destKey.lastIndexOf("/") + 1);
        const siblings = await listKeysUnderPrefix(parentPrefix);
        if (siblings.some((key) => key === destKey)) {
            throw httpError.badRequest("A PDF with this name already exists");
        }

        await copyStorageObject(sourceKey, destKey);
        await deleteStorageObject(sourceKey);

        return { pdfKey: destKey, renamed: true };
    },

    async promote(input: Static<typeof promoteBodySchema>) {
        await ProjectService.assertProjectExists(input.projectCode);

        const scope = resolveDraftScope();
        const sessionPrefix = buildSessionPrefix(scope, input.sessionId);
        const targetFolder = normalizeTargetRawFolderPath(input.targetFolderPath);
        const organizeRoot = input.organizeFolderPath?.trim().replace(/\/+$/, "") ?? "";

        const uniqueKeys = [...new Set((input.pdfKeys ?? []).map((k) => normalizeStorageKey(k)))];
        const uniqueFolderPaths = [...new Set((input.folderPaths ?? []).map((p) => p.trim().replace(/\/+$/, "")))].filter(Boolean);
        const plannedPromotions: Array<{
            pdfKey: string;
            pdfName: string;
            draftFolderPath: string;
            rawKey: string;
        }> = [];
        const results: Array<{
            folderPath: string;
            pdfName: string;
            rawKey: string;
            dossierId: string;
            fileId: string;
            created: boolean;
        }> = [];
        const errors: Array<{ folderPath: string; pdfName: string; error: string }> = [];

        for (const pdfKey of uniqueKeys) {
            const sourceKey = assertScanDraftKey(pdfKey);
            if (!sourceKey.startsWith(sessionPrefix)) {
                errors.push({
                    folderPath: "",
                    pdfName: storageBasename(sourceKey),
                    error: "PDF does not belong to this session",
                });
                continue;
            }
            if (!sourceKey.endsWith(".pdf")) {
                errors.push({
                    folderPath: "",
                    pdfName: storageBasename(sourceKey),
                    error: "Key must be a PDF file",
                });
                continue;
            }

            const relative = sourceKey.slice(sessionPrefix.length);
            const relativeParts = relative.split("/").filter(Boolean);
            const pdfName = resolvePromotePdfFileName(
                relativeParts,
                parseOrganizePdfRelative,
            );
            const organized = parseOrganizePdfRelative(relativeParts);
            const draftFolderPath = organized?.folderPath ?? "";

            if (organizeRoot && !isDraftFolderUnderOrganizeRoot(draftFolderPath, organizeRoot)) {
                errors.push({
                    folderPath: draftFolderPath,
                    pdfName,
                    error: "PDF is not under the selected organize folder",
                });
                continue;
            }

            plannedPromotions.push({
                pdfKey: sourceKey,
                pdfName,
                draftFolderPath,
                rawKey: buildPromoteRawKey(targetFolder, draftFolderPath, pdfName),
            });
        }

        if (plannedPromotions.length > 0) {
            try {
                const existingKeys = await loadExistingStorageFileKeysUnderPrefix(
                    targetFolder,
                );
                await assertNoMixedStorageFolderLayoutForKeys(
                    plannedPromotions.map((item) => item.rawKey),
                    { existingKeys },
                );
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    batchId: targetFolder,
                    promoted: 0,
                    results: [],
                    errors: plannedPromotions.map((item) => ({
                        folderPath: item.draftFolderPath,
                        pdfName: item.pdfName,
                        error: message,
                    })),
                };
            }
        }

        for (const item of plannedPromotions) {
            const { pdfKey: sourceKey, pdfName, draftFolderPath, rawKey } = item;

            try {
                await copyToRawPrefix(sourceKey, rawKey);
                // raw/ documents are never scoped to a project.
                const registerResult = await DossierService.createDocumentFromStorage({
                    key: rawKey,
                    projectCode: null,
                });
                await deleteStorageObject(sourceKey);
                results.push({
                    folderPath: draftFolderPath,
                    pdfName,
                    rawKey,
                    dossierId: registerResult.dossier.id,
                    fileId: registerResult.file.id,
                    created: registerResult.created,
                });
            } catch (err) {
                errors.push({
                    folderPath: draftFolderPath,
                    pdfName,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }

        const folderResults: Array<{ folderPath: string; created: boolean }> = [];
        if (uniqueFolderPaths.length > 0) {
            for (const folderPath of uniqueFolderPaths) {
                try {
                    const cleanPath = folderPath.startsWith("organize/")
                        ? folderPath.slice("organize/".length)
                        : folderPath;
                    const targetFolderOnly = cleanPath
                        ? `${targetFolder}/${cleanPath}`
                        : targetFolder;
                    await DossierService.ensureFolderTreeFromStorage({
                        folderPath: targetFolderOnly,
                        projectCode: null,
                    });
                    folderResults.push({ folderPath, created: true });
                } catch (err) {
                    errors.push({
                        folderPath,
                        pdfName: "",
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }
        }

        if (input.cleanup !== false && errors.length === 0 && (results.length > 0 || folderResults.length > 0)) {
            const remaining = await listKeysUnderPrefix(sessionPrefix);
            const hasRemainingDraftContent = remaining.some((key) => {
                const relative = key.slice(sessionPrefix.length);
                const parts = relative.split("/").filter(Boolean);
                if (parseOrganizePdfRelative(parts) !== null) return true;
                if (parseInboxPdfRelative(parts) !== null) return true;
                if (/\/inbox\/[^/]+\/pages\/\d{3}\.jpg$/i.test(key)) return true;
                return false;
            });
            if (!hasRemainingDraftContent) {
                await deleteKeysUnderPrefix(sessionPrefix);
            }
        }

        return {
            batchId: targetFolder,
            promoted: results.length,
            results,
            errors,
        };
    },

    async deleteSession(input: Static<typeof deleteSessionBodySchema>) {
        const scope = resolveDraftScope();
        const deleted = await deleteKeysUnderPrefix(
            buildSessionPrefix(scope, input.sessionId),
        );
        return { deleted: true, objectCount: deleted };
    },
};
