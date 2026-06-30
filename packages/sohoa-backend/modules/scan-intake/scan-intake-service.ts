import { httpError } from "@shared/common-lib";
import type { Static } from "elysia";
import { PDFDocument } from "pdf-lib";
import { ProjectService } from "../project/project-service.ts";
import { DossierService } from "../dossier/dossier-service.ts";
import { storageBasename } from "../dossier/dossier-path-utils.ts";
import {
    buildLinkGet,
    downloadBinaryFromStorage,
} from "../data-entry/data-entry-s3-utils.ts";
import { getS3Client } from "../../libs/s3.ts";
import {
    assertSafePathSegment,
    buildDocumentPdfKey,
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
    deleteSessionBodySchema,
    listSessionQuerySchema,
    organizeMoveBodySchema,
    presignedGetBodySchema,
    promoteBodySchema,
    reorderPagesBodySchema,
    uploadPointBodySchema,
} from "./types.ts";

const DEFAULT_EXPIRY = 3600;

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
        } else if (docSlug && fileName === "document.pdf") {
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
                } else if (parts[2] === "document.pdf") {
                    doc.pdfKey = key;
                }
            } else {
                const organized = parseOrganizePdfRelative(parts);
                if (organized) {
                    const { folderPath, fileName } = organized;
                    if (!folderPdfs.has(folderPath)) {
                        folderPdfs.set(folderPath, []);
                    }
                    folderPdfs.get(folderPath)!.push({ name: fileName, key });
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
            if (!doc.pdfKey && keys.includes(pdfKeyCandidate)) {
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
        const pdfKey = buildDocumentPdfKey(scope, input.sessionId, input.docSlug);

        await uploadBinaryToStorage(pdfKey, pdfBytes, "application/pdf");

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
        if (destRelative.startsWith("inbox/") || destRelative.split("/").some(isOrganizeTempSegment)) {
            throw httpError.badRequest("Invalid organize destination");
        }

        await copyStorageObject(sourceKey, destKey);
        await deleteStorageObject(sourceKey);

        return { sourceKey, destKey };
    },

    async promote(input: Static<typeof promoteBodySchema>) {
        await ProjectService.assertProjectExists(input.projectCode);

        const session = await this.listSession({
            sessionId: input.sessionId,
        });

        const scope = resolveDraftScope();
        const batchId = input.batchId ?? crypto.randomUUID();
        const results: Array<{
            folderPath: string;
            pdfName: string;
            rawKey: string;
            dossierId: string;
            fileId: string;
            created: boolean;
        }> = [];
        const errors: Array<{ folderPath: string; pdfName: string; error: string }> = [];

        for (const folder of session.folders) {
            const folderSlug = folder.folderPath;
            for (const pdf of folder.pdfs) {
                try {
                    const rawKey = await copyToRawPrefix(
                        pdf.key,
                        `raw/${input.projectCode}/${batchId}/${folderSlug}/${pdf.name}`,
                    );
                    const registerResult = await DossierService.createDocumentFromStorage({
                        key: rawKey,
                        projectCode: input.projectCode,
                    });
                    results.push({
                        folderPath: folder.folderPath,
                        pdfName: pdf.name,
                        rawKey,
                        dossierId: registerResult.dossier.id,
                        fileId: registerResult.file.id,
                        created: registerResult.created,
                    });
                } catch (err) {
                    errors.push({
                        folderPath: folder.folderPath,
                        pdfName: pdf.name,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }
        }

        if (input.cleanup !== false && errors.length === 0 && results.length > 0) {
            await deleteKeysUnderPrefix(
                buildSessionPrefix(scope, input.sessionId),
            );
        }

        return {
            batchId,
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
