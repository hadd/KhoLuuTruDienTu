import {
    normalizeAuditModule,
    resolveEventTypeFromMethod,
    resolveModuleFromPath,
} from "./audit-log-activity.ts";
import { normalizeAuditPathname } from "./audit-route-resolve.ts";

export type DerivedAuditLabel = {
    module: string | null;
    eventType: string | null;
    summary: string | null;
};

type PathLabelRule = {
    method: string;
    pattern: string;
    module?: string;
    eventType?: string;
    summary: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_RE = /^\d+$/;

const RESOURCE_LABELS: Record<string, string> = {
    fonds: "phông",
    "dossier-types": "loại hồ sơ",
    "document-types": "loại tài liệu",
    dossiers: "hồ sơ",
    documents: "tài liệu",
    files: "file",
    search: "kho lưu trữ",
    inventories: "mục lục",
    items: "mục kho",
    placements: "vị trí kho vật lý",
    "retention-periods": "thời hạn lưu trữ",
    users: "người dùng",
    roles: "vai trò",
    "security-levels": "cấp độ bảo mật",
    notifications: "thông báo",
    unplaced: "hồ sơ chưa gắn vị trí",
    unassigned: "hồ sơ chưa thuộc phông",
    tree: "cây kho vật lý",
    stats: "thống kê kho vật lý",
    metadata: "metadata",
    claim: "hồ sơ biên tập",
    approve: "duyệt biên tập",
    reject: "từ chối biên tập",
    pending: "đơn chờ duyệt",
    prepare: "chuẩn bị",
    status: "trạng thái",
    permissions: "quyền",
    folders: "thư mục",
    "scan-intake": "phiên scan",
    "digital-sign": "ký số",
    "issue-reports": "thông báo vấn đề",
    sessions: "phiên scan",
    session: "phiên scan",
    promote: "đẩy lên hồ sơ",
    submit: "gửi ký",
    verify: "xác minh chữ ký",
    history: "lịch sử ký",
    groups: "nhóm",
    projects: "dự án",
    "project-plans": "kế hoạch dự án",
    "metadata-templates": "mẫu metadata",
    "metadata-permission-configs": "phân quyền metadata",
    "metadata-export-presets": "preset xuất metadata",
    "document-naming-configs": "quy tắc đặt tên",
    "archive-acl": "ACL kho",
    "audit-logs": "nhật ký hệ thống",
    "audit-log-config": "cấu hình nhật ký",
    "security-permission-defs": "định nghĩa quyền bảo mật",
};

/** Explicit path labels for known warehouse / config routes. */
const PATH_LABEL_RULES: PathLabelRule[] = [
    { method: "GET", pattern: "/archive-warehouse/fonds", module: "archive", eventType: "view", summary: "Xem danh sách phông trong kho" },
    { method: "GET", pattern: "/archive-warehouse/dossier-types", module: "archive", eventType: "view", summary: "Xem danh sách loại hồ sơ trong kho" },
    { method: "GET", pattern: "/archive-warehouse/dossier-types/:id/summary", module: "archive", eventType: "view", summary: "Xem thống kê theo loại hồ sơ" },
    { method: "GET", pattern: "/archive-warehouse/document-types", module: "archive", eventType: "view", summary: "Xem danh sách loại tài liệu trong kho" },
    { method: "GET", pattern: "/archive-warehouse/document-types/:id/summary", module: "archive", eventType: "view", summary: "Xem thống kê theo loại tài liệu" },
    { method: "GET", pattern: "/archive-warehouse/fonds/:id/summary", module: "archive", eventType: "view", summary: "Xem thống kê theo phông" },
    { method: "GET", pattern: "/archive-warehouse/dossiers", module: "archive", eventType: "view", summary: "Duyệt hồ sơ đã lưu kho theo phông" },
    { method: "GET", pattern: "/archive-warehouse/dossiers/unassigned", module: "archive", eventType: "view", summary: "Xem hồ sơ đã lưu kho chưa thuộc phông" },
    { method: "GET", pattern: "/archive-warehouse/dossiers/by-dossier-type", module: "archive", eventType: "view", summary: "Duyệt hồ sơ đã lưu kho theo loại hồ sơ" },
    { method: "GET", pattern: "/archive-warehouse/documents/by-document-type", module: "archive", eventType: "view", summary: "Duyệt tài liệu đã lưu kho theo loại tài liệu" },
    { method: "GET", pattern: "/archive-warehouse/dossiers/:id", module: "archive", eventType: "view", summary: "Xem chi tiết hồ sơ trong kho" },
    { method: "GET", pattern: "/archive-warehouse/search", module: "archive", eventType: "view", summary: "Tìm kiếm trong kho lưu trữ" },

    { method: "GET", pattern: "/physical-warehouse/items", module: "physical-warehouse", eventType: "view", summary: "Xem danh sách mục kho vật lý" },
    { method: "GET", pattern: "/physical-warehouse/items/tree", module: "physical-warehouse", eventType: "view", summary: "Xem cây kho vật lý" },
    { method: "GET", pattern: "/physical-warehouse/items/stats", module: "physical-warehouse", eventType: "view", summary: "Xem thống kê kho vật lý" },
    { method: "GET", pattern: "/physical-warehouse/items/:id", module: "physical-warehouse", eventType: "view", summary: "Xem chi tiết mục kho vật lý" },
    { method: "GET", pattern: "/physical-warehouse/placements", module: "physical-warehouse", eventType: "view", summary: "Xem danh sách vị trí gắn hồ sơ" },
    { method: "GET", pattern: "/physical-warehouse/placements/unplaced", module: "physical-warehouse", eventType: "view", summary: "Xem hồ sơ chưa gắn vị trí kho vật lý" },

    { method: "GET", pattern: "/inventories", module: "inventories", eventType: "view", summary: "Xem danh sách mục lục" },
    { method: "GET", pattern: "/inventories/active", module: "inventories", eventType: "view", summary: "Xem mục lục đang hoạt động" },
    { method: "GET", pattern: "/inventories/:id", module: "inventories", eventType: "view", summary: "Xem chi tiết mục lục" },

    { method: "GET", pattern: "/fonds", module: "fonds", eventType: "view", summary: "Xem danh sách phông lưu trữ" },
    { method: "GET", pattern: "/fonds/:id", module: "fonds", eventType: "view", summary: "Xem chi tiết phông lưu trữ" },
    { method: "GET", pattern: "/retention-periods", module: "retention-periods", eventType: "view", summary: "Xem danh sách thời hạn lưu trữ" },
    { method: "GET", pattern: "/retention-periods/:id", module: "retention-periods", eventType: "view", summary: "Xem chi tiết thời hạn lưu trữ" },

    { method: "GET", pattern: "/data-entry/maker/claim", module: "data-entry", eventType: "view", summary: "Nhận hồ sơ biên tập" },
    { method: "GET", pattern: "/data-entry/maker/dossiers/:id", module: "data-entry", eventType: "view", summary: "Xem hồ sơ đang biên tập" },
    { method: "POST", pattern: "/data-entry/checker/approve/:id", module: "data-entry", eventType: "approve", summary: "Duyệt biên tập hồ sơ" },
    { method: "POST", pattern: "/data-entry/checker/reject/:id", module: "data-entry", eventType: "reject", summary: "Từ chối biên tập hồ sơ" },

    { method: "GET", pattern: "/dossiers/:id/prepare", module: "data-entry", eventType: "view", summary: "Chuẩn bị form nộp lưu kho" },
    { method: "GET", pattern: "/dossiers/:id/metadata-history", module: "data-entry", eventType: "view", summary: "Xem lịch sử metadata của hồ sơ" },
    { method: "PUT", pattern: "/dossiers/:id/metadata", module: "data-entry", eventType: "edit", summary: "Gửi biên tập hồ sơ" },
    { method: "POST", pattern: "/dossiers/assignments/drafts/submit", module: "data-entry", eventType: "edit", summary: "Gửi/duyệt hàng loạt hồ sơ nháp" },

    { method: "GET", pattern: "/archive-submissions/pending", module: "archive", eventType: "view", summary: "Xem đơn nộp lưu kho chờ duyệt" },
    { method: "GET", pattern: "/archive-submissions/dossiers", module: "archive", eventType: "view", summary: "Xem hồ sơ trong quy trình lưu kho" },
    { method: "GET", pattern: "/archive-submissions/dossier/:id/prepare", module: "archive", eventType: "view", summary: "Chuẩn bị form nộp lưu kho" },
    { method: "POST", pattern: "/archive-submissions/physical-location/place", module: "archive", eventType: "place_physical", summary: "Xếp hồ sơ vào kho vật lý" },
    { method: "POST", pattern: "/archive-submissions/physical-location/move", module: "archive", eventType: "move_physical", summary: "Đổi vị trí kho vật lý" },
    { method: "POST", pattern: "/archive-submissions/physical-location/remove", module: "archive", eventType: "remove_physical", summary: "Gỡ hồ sơ khỏi kho vật lý" },

    { method: "POST", pattern: "/issue-reports/:id/confirm", module: "issue-reports", eventType: "confirm", summary: "Xác nhận thông báo vấn đề tài liệu" },
    { method: "POST", pattern: "/issue-reports/:id/reject", module: "issue-reports", eventType: "reject", summary: "Từ chối thông báo vấn đề tài liệu" },
    { method: "POST", pattern: "/issue-reports/:id/escalate", module: "issue-reports", eventType: "escalate", summary: "Chuyển tiếp thông báo vấn đề tới quản lý dự án" },
    { method: "GET", pattern: "/issue-reports/dossier/:dossierId", module: "issue-reports", eventType: "view", summary: "Xem thông báo vấn đề của hồ sơ" },

    { method: "GET", pattern: "/folders", module: "folders", eventType: "view", summary: "Xem danh sách thư mục" },
    { method: "GET", pattern: "/folders/:id", module: "folders", eventType: "view", summary: "Xem chi tiết thư mục" },
    { method: "GET", pattern: "/folders/all-parent", module: "folders", eventType: "view", summary: "Xem cây thư mục cha" },
    { method: "GET", pattern: "/folders/:id/all-first-subfolders", module: "folders", eventType: "view", summary: "Xem danh sách thư mục con" },

    { method: "GET", pattern: "/scan-intake/sessions", module: "scan-intake", eventType: "view", summary: "Xem danh sách phiên scan" },
    { method: "GET", pattern: "/scan-intake/session", module: "scan-intake", eventType: "view", summary: "Xem chi tiết phiên scan" },

    { method: "GET", pattern: "/digital-sign/status/:dossierId", module: "digital-sign", eventType: "view", summary: "Xem trạng thái ký số hồ sơ" },
    { method: "GET", pattern: "/digital-sign/history/:dossierId", module: "digital-sign", eventType: "view", summary: "Xem lịch sử ký số hồ sơ" },

    { method: "GET", pattern: "/dossier-types", module: "dossier-types", eventType: "view", summary: "Xem danh sách loại hồ sơ" },
    { method: "GET", pattern: "/dossier-types/:id", module: "dossier-types", eventType: "view", summary: "Xem chi tiết loại hồ sơ" },
    { method: "GET", pattern: "/document-types", module: "document-types", eventType: "view", summary: "Xem danh sách loại tài liệu" },
    { method: "GET", pattern: "/document-types/:id", module: "document-types", eventType: "view", summary: "Xem chi tiết loại tài liệu" },

    { method: "GET", pattern: "/security-levels", module: "security-levels", eventType: "view", summary: "Xem danh sách cấp độ bảo mật" },
    { method: "GET", pattern: "/security-levels/:id", module: "security-levels", eventType: "view", summary: "Xem chi tiết cấp độ bảo mật" },
    { method: "GET", pattern: "/security-permission-defs", module: "security-levels", eventType: "view", summary: "Xem định nghĩa quyền bảo mật" },

    { method: "GET", pattern: "/notifications", module: "notifications", eventType: "view", summary: "Xem hộp thư thông báo" },

    { method: "GET", pattern: "/admin/roles/:id/permissions", module: "roles", eventType: "view", summary: "Xem quyền của vai trò" },
    { method: "GET", pattern: "/admin/metadata-templates", module: "metadata", eventType: "view", summary: "Xem danh sách mẫu metadata" },
    { method: "GET", pattern: "/admin/metadata-templates/:id", module: "metadata", eventType: "view", summary: "Xem chi tiết mẫu metadata" },
    { method: "GET", pattern: "/admin/groups", module: "groups", eventType: "view", summary: "Xem danh sách nhóm" },
    { method: "GET", pattern: "/admin/groups/:id", module: "groups", eventType: "view", summary: "Xem chi tiết nhóm" },
    { method: "GET", pattern: "/admin/projects", module: "projects", eventType: "view", summary: "Xem danh sách dự án" },
    { method: "GET", pattern: "/admin/projects/:id", module: "projects", eventType: "view", summary: "Xem chi tiết dự án" },
    { method: "GET", pattern: "/admin/audit-logs", module: "audit-log", eventType: "view", summary: "Xem nhật ký hệ thống" },
    { method: "GET", pattern: "/admin/audit-log-config", module: "audit-log-config", eventType: "view", summary: "Xem cấu hình nhật ký" },
    { method: "GET", pattern: "/admin/archive-acl/matrix", module: "archive", eventType: "view", summary: "Xem ma trận ACL kho" },

    { method: "GET", pattern: "project-plans", module: "project-plans", eventType: "view", summary: "Xem kế hoạch dự án" },
    { method: "GET", pattern: "project-plans/:id", module: "project-plans", eventType: "view", summary: "Xem chi tiết kế hoạch dự án" },
    { method: "GET", pattern: "project-plans/:id/details", module: "project-plans", eventType: "view", summary: "Xem chi tiết kế hoạch dự án" },
    { method: "GET", pattern: "project-plans/:id/details", module: "project-plans", eventType: "view", summary: "Xem chi tiết kế hoạch dự án" },
];

function patternToRegex(pattern: string): RegExp {
    const parts = pattern.split("/").filter(Boolean);
    const regexParts = parts.map((part) => {
        if (part.startsWith(":")) return "([^/]+)";
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
    return new RegExp(`^/${regexParts.join("/")}$`);
}

function isIdSegment(segment: string): boolean {
    return UUID_RE.test(segment) || NUMERIC_RE.test(segment);
}

function resourceLabel(segment: string): string {
    return RESOURCE_LABELS[segment] ?? segment.replace(/-/g, " ");
}

function matchPathRule(method: string, pathname: string): PathLabelRule | null {
    const normalizedPath = normalizeAuditPathname(pathname);
    const upperMethod = method.toUpperCase();

    for (const rule of PATH_LABEL_RULES) {
        if (rule.method.toUpperCase() !== upperMethod) continue;
        if (patternToRegex(rule.pattern).test(normalizedPath)) {
            return rule;
        }
    }
    return null;
}

function genericSummary(method: string, pathname: string): string {
    const normalized = normalizeAuditPathname(pathname);
    const segments = normalized.split("/").filter(Boolean);
    const withoutMeta = segments.filter((s) => s !== "api" && s !== "v1" && s !== "admin");

    let leaf = withoutMeta[withoutMeta.length - 1] ?? "tài nguyên";
    let hasId = withoutMeta.some(isIdSegment);

    const prev = withoutMeta[withoutMeta.length - 2];
    if (
        leaf &&
        prev &&
        !RESOURCE_LABELS[leaf] &&
        !isIdSegment(leaf) &&
        !isIdSegment(prev) &&
        (RESOURCE_LABELS[prev] || prev.includes("-"))
    ) {
        // Path param that is not UUID/numeric (e.g. /items/abc)
        hasId = true;
        leaf = prev;
    } else if (isIdSegment(leaf) && prev) {
        hasId = true;
        leaf = prev;
    }

    const label = resourceLabel(leaf);
    const upper = method.toUpperCase();

    if (upper === "GET") {
        if (leaf === "search") return `Tìm kiếm ${label}`;
        if (leaf === "summary" || leaf === "stats") {
            const parent = withoutMeta[withoutMeta.length - 2];
            return parent
                ? `Xem thống kê ${resourceLabel(parent)}`
                : `Xem thống kê ${label}`;
        }
        return hasId ? `Xem chi tiết ${label}` : `Xem danh sách ${label}`;
    }
    if (upper === "POST") return `Tạo ${label}`;
    if (upper === "PUT" || upper === "PATCH") return `Cập nhật ${label}`;
    if (upper === "DELETE") return `Xóa ${label}`;
    return `${upper} ${label}`;
}

/**
 * Derive human-readable audit fields from HTTP method + path.
 * Used when enrichers / explicit meta do not provide summary.
 */
export function deriveAuditFromPath(
    method: string,
    pathname: string,
): DerivedAuditLabel {
    const rule = matchPathRule(method, pathname);
    if (rule) {
        return {
            module: normalizeAuditModule(rule.module ?? resolveModuleFromPath(pathname)),
            eventType: rule.eventType ?? resolveEventTypeFromMethod(method),
            summary: rule.summary,
        };
    }

    return {
        module: resolveModuleFromPath(pathname),
        eventType: resolveEventTypeFromMethod(method),
        summary: genericSummary(method, pathname),
    };
}
