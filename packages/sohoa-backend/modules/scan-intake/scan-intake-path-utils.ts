import { httpError } from "@shared/common-lib";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";

export const SCAN_DRAFT_PREFIX = "scan-draft";

/** Draft scans are stored under this scope until promote assigns a real project. */
export const SCAN_WORKSPACE = "_workspace";

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

export function resolveDraftScope(_projectCode?: string): string {
    return SCAN_WORKSPACE;
}

export function assertSafePathSegment(segment: string, label: string): string {
    const trimmed = segment.trim();
    if (!trimmed || !SAFE_SEGMENT.test(trimmed)) {
        throw httpError.badRequest(`Invalid ${label}`);
    }
    return trimmed;
}

export function buildSessionPrefix(projectCode: string, sessionId: string): string {
    return `${SCAN_DRAFT_PREFIX}/${assertSafePathSegment(projectCode, "projectCode")}/${assertSafePathSegment(sessionId, "sessionId")}/`;
}

export function buildInboxDocPrefix(
    projectCode: string,
    sessionId: string,
    docSlug: string,
): string {
    return `${buildSessionPrefix(projectCode, sessionId)}inbox/${assertSafePathSegment(docSlug, "docSlug")}/`;
}

export function buildPageKey(
    projectCode: string,
    sessionId: string,
    docSlug: string,
    pageFileName: string,
): string {
    const safeName = pageFileName.replace(/^\/+/, "");
    if (!/^\d{3}\.jpg$/i.test(safeName)) {
        throw httpError.badRequest("Page file name must match NNN.jpg");
    }
    return `${buildInboxDocPrefix(projectCode, sessionId, docSlug)}pages/${safeName}`;
}

export function sanitizeInboxLabelToPdfBase(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        return "untitled";
    }
    const slug = trimmed
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 120);
    return slug || "untitled";
}

export function resolveInboxPdfBaseName(
    docSlug: string,
    displayName?: string,
): string {
    if (displayName?.trim()) {
        return assertSafePathSegment(
            sanitizeInboxLabelToPdfBase(displayName),
            "displayName",
        );
    }
    return assertSafePathSegment(docSlug, "docSlug");
}

export function buildInboxDocumentPdfFileName(
    docSlug: string,
    displayName?: string,
): string {
    return `${resolveInboxPdfBaseName(docSlug, displayName)}.pdf`;
}

export function buildDocumentPdfKey(
    projectCode: string,
    sessionId: string,
    docSlug: string,
    displayName?: string,
): string {
    return `${buildInboxDocPrefix(projectCode, sessionId, docSlug)}${buildInboxDocumentPdfFileName(docSlug, displayName)}`;
}

export function isInboxDocumentPdfFileName(
    docSlug: string,
    fileName: string,
): boolean {
    const safeSlug = assertSafePathSegment(docSlug, "docSlug");
    return fileName === `${safeSlug}.pdf`;
}

export function isLegacyInboxPdfFileName(fileName: string): boolean {
    return fileName.toLowerCase() === "document.pdf";
}

export function isInboxPdfUploadFileName(
    docSlug: string,
    fileName: string,
): boolean {
    return isInboxDocumentPdfFileName(docSlug, fileName) ||
        isLegacyInboxPdfFileName(fileName);
}

export function parseInboxPdfRelative(
    parts: string[],
): { docSlug: string; fileName: string } | null {
    if (parts.length !== 3 || parts[0] !== "inbox") return null;
    const fileName = parts[2]!;
    if (!fileName.toLowerCase().endsWith(".pdf")) return null;
    try {
        assertSafePathSegment(parts[1]!, "docSlug");
    } catch {
        return null;
    }
    return { docSlug: parts[1]!, fileName };
}

export function resolvePromotePdfFileName(
    relativeParts: string[],
    parseOrganized: (
        parts: string[],
    ) => { folderPath: string; fileName: string } | null,
): string {
    const inbox = parseInboxPdfRelative(relativeParts);
    if (inbox) {
        return buildInboxDocumentPdfFileName(inbox.docSlug);
    }

    const organized = parseOrganized(relativeParts);
    if (organized) {
        const fileName = organized.fileName;
        if (isLegacyInboxPdfFileName(fileName)) {
            const leaf = organized.folderPath.split("/").pop();
            if (leaf) {
                return `${assertSafePathSegment(leaf, "folderPath")}.pdf`;
            }
        }
        return fileName;
    }

    const fallback = relativeParts[relativeParts.length - 1] ?? "untitled.pdf";
    if (isLegacyInboxPdfFileName(fallback)) {
        return "untitled.pdf";
    }
    return fallback.toLowerCase().endsWith(".pdf") ? fallback : `${fallback}.pdf`;
}

export function assertScanDraftKey(key: string, projectCode?: string): string {
    const normalized = normalizeStorageKey(key);
    if (!normalized.startsWith(`${SCAN_DRAFT_PREFIX}/`)) {
        throw httpError.badRequest("Key must be under scan-draft/");
    }
    if (projectCode) {
        const expected = `${SCAN_DRAFT_PREFIX}/${assertSafePathSegment(projectCode, "projectCode")}/`;
        if (!normalized.startsWith(expected)) {
            throw httpError.badRequest("Key does not match project");
        }
    }
    return normalized;
}

export function parseSessionPrefix(prefix: string): { projectCode: string; sessionId: string } | null {
    const normalized = normalizeStorageKey(prefix).replace(/\/+$/, "");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length < 3 || parts[0] !== SCAN_DRAFT_PREFIX) return null;
    return { projectCode: parts[1]!, sessionId: parts[2]! };
}
