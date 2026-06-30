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

export function buildDocumentPdfKey(
    projectCode: string,
    sessionId: string,
    docSlug: string,
): string {
    return `${buildInboxDocPrefix(projectCode, sessionId, docSlug)}document.pdf`;
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
