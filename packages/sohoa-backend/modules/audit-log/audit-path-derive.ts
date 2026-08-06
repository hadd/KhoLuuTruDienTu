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

    // ═══════════════════════════════════════════
    // MODULE: AUTH
    // ═══════════════════════════════════════════
    login: "đăng nhập ",                          // [MỚI]
    refresh: "làm mới token ",                   // [MỚI]
    logout: "đăng xuất ",                        // [MỚI]
    me: "tài khoản hiện tại ",                   // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - USERS & PROFILE
    // ═══════════════════════════════════════════
    users: "người dùng ",                        // [CŨ]
    "permanent-delete": "xóa vĩnh viễn ",        // [MỚI]
    "reset-password": "đặt lại mật khẩu ",       // [MỚI]
    template: "mẫu nhập ",                       // [MỚI]
    export: "xuất dữ liệu ",                     // [MỚI]
    import: "nhập dữ liệu ",                     // [MỚI]
    "by-permission": "theo quyền ",              // [MỚI]
    profile: "hồ sơ cá nhân ",                   // [MỚI]
    "download-password": "mật khẩu tải xuống ",  // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - ROLES & PERMISSIONS
    // ═══════════════════════════════════════════
    roles: "vai trò ",                           // [CŨ]
    permissions: "quyền ",                       // [CŨ]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - AUDIT LOG
    // ═══════════════════════════════════════════
    "audit-logs": "lịch sử thao tác hệ thống ",  // [CŨ]
    "audit-log-config": "cấu hình lịch sử thao tác hệ thống ", // [CŨ]
    "filter-options": "tùy chọn lọc ",           // [MỚI]
    bulk: "xóa hàng loạt ",                      // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - METADATA TEMPLATES
    // ═══════════════════════════════════════════
    "metadata-templates": "mẫu metadata ",       // [CŨ]
    "toggle-active": "bật/tắt mẫu ",             // [MỚI]
    "dossier-options": "tùy chọn hồ sơ ",        // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - METADATA PERMISSION CONFIGS
    // ═══════════════════════════════════════════
    "metadata-permission-configs": "phân quyền metadata ", // [CŨ]
    slots: "vị trí phân quyền ",                 // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - METADATA EXPORT PRESETS
    // ═══════════════════════════════════════════
    "metadata-export-presets": "preset xuất metadata ", // [CŨ]
    "export-options": "tùy chọn xuất ",          // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - GROUPS
    // ═══════════════════════════════════════════
    groups: "nhóm ",                             // [CŨ]
    "available-editors": "biên tập viên khả dụng ", // [MỚI]
    "assign-by-folder": "phân công theo thư mục ", // [MỚI]
    "revoke-by-folder": "thu hồi phân công theo thư mục ", // [MỚI]
    continue: "tiếp tục phân công ",             // [MỚI]
    "sync-qc-workflow": "đồng bộ quy trình QC ", // [MỚI]
    "metadata-permission-config": "cấu hình phân quyền metadata ", // [MỚI]
    "metadata-permission": "phân quyền metadata nhóm ", // [MỚI]
    "permission-assignments": "gán quyền biên tập ", // [MỚI]
    "folder-queue": "hàng đợi thư mục ",         // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - PROJECTS
    // ═══════════════════════════════════════════
    projects: "dự án ",                          // [CŨ]
    options: "tùy chọn ",                        // [MỚI]
    "progress-history": "lịch sử tiến độ ",      // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - ISSUE REPORTS
    // ═══════════════════════════════════════════
    "issue-reports": "thông báo vấn đề ",        // [CŨ]
    close: "đóng vấn đề ",                       // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - DASHBOARD
    // ═══════════════════════════════════════════
    dashboard: "bảng điều khiển ",               // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - ARCHIVE FIELD CONFIGS
    // ═══════════════════════════════════════════
    "archive-field-configs": "cấu hình trường lưu kho ", // [MỚI]
    reorder: "sắp xếp lại ",                     // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - ARCHIVE ACL
    // ═══════════════════════════════════════════
    "archive-acl": "ACL kho ",                   // [CŨ]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - NOTIFICATION CONFIGS
    // ═══════════════════════════════════════════
    "notification-configs": "cấu hình thông báo ", // [MỚI]
    "email-sender": "cấu hình gửi email ",       // [MỚI]
    "test-send": "gửi email thử ",               // [MỚI]
    activate: "kích hoạt ",                      // [MỚI]
    deactivate: "vô hiệu hóa ",                  // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - WATERMARK
    // ═══════════════════════════════════════════
    watermark: "watermark ",                     // [MỚI]
    images: "ảnh watermark ",                    // [MỚI]
    placements: "vị trí kho vật lý ",            // [CŨ]
    "pdf-security": "bảo mật PDF ",              // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ADMIN - DOCUMENT NAMING CONFIGS
    // ═══════════════════════════════════════════
    "document-naming-configs": "quy tắc đặt tên ", // [CŨ]
    "field-catalog": "danh mục trường ",         // [MỚI]
    preview: "xem trước ",                       // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: DOSSIERS (Hồ sơ)
    // ═══════════════════════════════════════════
    dossiers: "hồ sơ ",                          // [CŨ]
    documents: "tài liệu ",                      // [CŨ]
    files: "file ",                              // [CŨ]
    metadata: "metadata ",                       // [CŨ]
    prepare: "chuẩn bị ",                        // [CŨ]
    status: "trạng thái ",                       // [CŨ]
    claim: "hồ sơ biên tập ",                    // [CŨ]
    approve: "duyệt biên tập ",                  // [CŨ]
    reject: "từ chối biên tập ",                 // [CŨ]
    pending: "đơn chờ duyệt ",                   // [CŨ]
    submit: "gửi ký ",                           // [CŨ]
    verify: "xác minh chữ ký ",                  // [CŨ]
    history: "lịch sử ký ",                      // [CŨ]
    "check-file-path": "kiểm tra đường dẫn file ", // [MỚI]
    "create-upload-point": "tạo điểm tải lên ",  // [MỚI]
    "create-document-from-storage": "đăng ký tài liệu từ storage ", // [MỚI]
    "ocr-control": "kiểm soát OCR ",             // [MỚI]
    "pending-manual": "chờ kích hoạt OCR thủ công ", // [MỚI]
    tracked: "OCR đang xử lý ",                  // [MỚI]
    trigger: "kích hoạt OCR ",                   // [MỚI]
    assignments: "phân công ",                   // [MỚI]
    "by-role": "theo vai trò ",                  // [MỚI]
    drafts: "bản nháp ",                         // [MỚI]
    dip: "gói DIP ",                             // [MỚI]
    aip: "gói AIP ",                             // [MỚI]
    "verify-access": "xác thực truy cập ",       // [MỚI]
    "metadata-history": "lịch sử metadata ",     // [MỚI]
    restore: "khôi phục ",                       // [MỚI]
    "workflow-logs": "lịch sử workflow ",        // [MỚI]
    assign: "phân công hồ sơ ",                  // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: SCAN INTAKE
    // ═══════════════════════════════════════════
    "scan-intake": "phiên scan ",                // [CŨ]
    sessions: "phiên scan ",                     // [CŨ]
    session: "phiên scan ",                      // [CŨ]
    promote: "đẩy lên hồ sơ ",                   // [CŨ]
    "upload-point": "điểm tải lên ",             // [MỚI]
    "presigned-get": "URL tải xuống ",           // [MỚI]
    "assemble-pdf": "ghép PDF ",                 // [MỚI]
    pages: "trang scan ",                        // [MỚI]
    "delete-bulk": "xóa hàng loạt ",             // [MỚI]
    "organize-move": "di chuyển PDF ",           // [MỚI]
    "organize-rename-folder": "đổi tên thư mục scan ", // [MỚI]
    "organize-rename-pdf": "đổi tên PDF ",       // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: DIGITAL SIGN
    // ═══════════════════════════════════════════
    "digital-sign": "ký số ",                    // [CŨ]
  
    // ═══════════════════════════════════════════
    // MODULE: FOLDERS (Thư mục)
    // ═══════════════════════════════════════════
    folders: "thư mục ",                         // [CŨ]
    "revoke-assignments": "thu hồi phân công ",  // [MỚI]
    project: "dự án thư mục ",                   // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: FONDS (Phông lưu trữ)
    // ═══════════════════════════════════════════
    fonds: "phông ",                             // [CŨ]
    active: "đang hoạt động ",                   // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: RETENTION PERIODS
    // ═══════════════════════════════════════════
    "retention-periods": "thời hạn lưu trữ ",    // [CŨ]
  
    // ═══════════════════════════════════════════
    // MODULE: INVENTORIES (Mục lục)
    // ═══════════════════════════════════════════
    inventories: "mục lục ",                     // [CŨ]
  
    // ═══════════════════════════════════════════
    // MODULE: DOSSIER TYPES & DOCUMENT TYPES
    // ═══════════════════════════════════════════
    "dossier-types": "loại hồ sơ ",              // [CŨ]
    "document-types": "loại tài liệu ",          // [CŨ]
  
    // ═══════════════════════════════════════════
    // MODULE: PHYSICAL WAREHOUSE (Kho vật lý)
    // ═══════════════════════════════════════════
    items: "mục kho ",                           // [CŨ]
    unplaced: "hồ sơ chưa gắn vị trí ",          // [CŨ]
    unassigned: "hồ sơ chưa thuộc phông ",       // [CŨ]
    tree: "cây kho vật lý ",                     // [CŨ]
    stats: "thống kê kho vật lý ",               // [CŨ]
    "bottom-boxes": "ô chứa cấp cuối ",          // [MỚI]
    "upload-image": "tải ảnh kho ",              // [MỚI]
    reparent: "di chuyển ô chứa ",               // [MỚI]
    move: "di chuyển ",                          // [MỚI]
    remove: "gỡ ",                               // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: DATA ENTRY
    // ═══════════════════════════════════════════
    // (dùng labels chung: claim, approve, reject đã có ở trên)
  
    // ═══════════════════════════════════════════
    // MODULE: DASHBOARD (User)
    // ═══════════════════════════════════════════
    editor: "bảng điều khiển biên tập ",         // [MỚI]
    qc: "bảng điều khiển QC ",                   // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: INTERNAL
    // ═══════════════════════════════════════════
    "ocr-callback": "callback OCR ",             // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: METADATA EXTRACT
    // ═══════════════════════════════════════════
    "extract-settings": "cấu hình trích xuất ",  // [MỚI]
    extract: "trích xuất metadata ",             // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: PROJECT PLANS & PAPER
    // ═══════════════════════════════════════════
    "project-plans": "kế hoạch dự án ",          // [CŨ]
    detail: "chi tiết ",                         // [MỚI]
    "paper-sizes": "khổ giấy ",                  // [MỚI]
    "paper-plans": "kế hoạch giấy ",             // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: NOTIFICATIONS
    // ═══════════════════════════════════════════
    notifications: "thông báo ",                  // [CŨ]
    "unread-count": "số chưa đọc ",              // [MỚI]
    "read-all": "đánh dấu tất cả đã đọc ",       // [MỚI]
    read: "đánh dấu đã đọc ",                    // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ARCHIVE SUBMISSIONS
    // ═══════════════════════════════════════════
    "field-configs": "cấu hình trường lưu kho ", // [MỚI]
    "physical-location": "vị trí kho vật lý ",   // [MỚI]
    boxes: "hộp kho ",                           // [MỚI]
    "by-dossier": "theo hồ sơ ",                 // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ARCHIVE WAREHOUSE
    // ═══════════════════════════════════════════
    search: "kho lưu trữ ",                      // [CŨ]
  
    // ═══════════════════════════════════════════
    // MODULE: ARCHIVE EXPLOITATION
    // ═══════════════════════════════════════════
    "archive-exploitation": "khai thác kho ",    // [MỚI]
    summary: "thống kê ",                        // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ARCHIVE DISPOSAL
    // ═══════════════════════════════════════════
    "archive-disposal": "xét hủy ",              // [MỚI]
    candidates: "hồ sơ hết hạn ",                // [MỚI]
    catalogs: "danh mục đề xuất hủy ",           // [MỚI]
    councils: "hội đồng xét hủy ",               // [MỚI]
    "transfer-to-proposal": "chuyển sang đề xuất hủy ", // [MỚI]
    settings: "cấu hình ",                       // [MỚI]
    "execute-destroy": "thực hiện hủy ",         // [MỚI]
    "available-for-council": "danh mục khả dụng ", // [MỚI]
    "copy-members": "sao chép thành viên ",      // [MỚI]
    members: "thành viên ",                      // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: ARCHIVE BORROW
    // ═══════════════════════════════════════════
    "archive-borrow-requests": "mượn tài liệu ", // [MỚI]
    mine: "yêu cầu của tôi ",                    // [MỚI]
    "reading-summary": "tóm tắt đang đọc ",      // [MỚI]
    "search-dossiers": "tìm hồ sơ mượn ",        // [MỚI]
    "regenerate-dip": "tạo lại gói DIP ",        // [MỚI]
    "view-model": "xem nội dung mượn ",          // [MỚI]
    "reading-progress": "tiến độ đọc ",          // [MỚI]
    annotations: "ghi chú ",                     // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: SECURITY LEVELS & PERMISSION DEFS
    // ═══════════════════════════════════════════
    "security-levels": "cấp độ bảo mật ",        // [CŨ]
    "security-permission-defs": "định nghĩa quyền bảo mật ", // [CŨ]
    "verify-file-access": "xác thực truy cập file ", // [MỚI]
    rules: "quy tắc bảo mật ",                   // [MỚI]
  
    // ═══════════════════════════════════════════
    // MODULE: HEALTH CHECK
    // ═══════════════════════════════════════════
    health: "kiểm tra hệ thống ",                // [MỚI]
  };

/** Explicit path labels for known warehouse / config routes. */
const PATH_LABEL_RULES: PathLabelRule[] = [

    // ═══════════════════════════════════════════════════════════
    // MODULE: HEALTH CHECK
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/public/health", module: "health", eventType: "view", summary: "Kiểm tra trạng thái hệ thống" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: AUTH
    // ═══════════════════════════════════════════════════════════
    { method: "POST", pattern: "/auth/login", module: "auth", eventType: "login", summary: "Đăng nhập hệ thống" }, // [MỚI]
    { method: "POST", pattern: "/auth/refresh", module: "auth", eventType: "refresh", summary: "Làm mới access token" }, // [MỚI]
    { method: "POST", pattern: "/auth/logout", module: "auth", eventType: "logout", summary: "Đăng xuất" }, // [MỚI]
    { method: "GET", pattern: "/auth/me", module: "auth", eventType: "view", summary: "Xem thông tin tài khoản hiện tại" }, // [MỚI]
    { method: "DELETE", pattern: "/auth/me", module: "auth", eventType: "delete", summary: "Xóa tài khoản hiện tại" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - USERS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/users/all", module: "admin-users", eventType: "view", summary: "Xem danh sách người dùng" }, // [MỚI]
    { method: "GET", pattern: "/admin/users/roles", module: "admin-users", eventType: "view", summary: "Xem danh sách vai trò người dùng" }, // [MỚI]
    { method: "GET", pattern: "/admin/users/by-permission/:permission", module: "admin-users", eventType: "view", summary: "Xem người dùng theo quyền" }, // [MỚI]
    { method: "POST", pattern: "/admin/users/permanent-delete", module: "admin-users", eventType: "delete", summary: "Xóa vĩnh viễn người dùng" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/users/permanent-delete", module: "admin-users", eventType: "delete", summary: "Xóa vĩnh viễn người dùng" }, // [MỚI]
    { method: "GET", pattern: "/admin/users/:id", module: "admin-users", eventType: "view", summary: "Xem chi tiết người dùng" }, // [MỚI]
    { method: "PUT", pattern: "/admin/users/:id", module: "admin-users", eventType: "edit", summary: "Cập nhật người dùng" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/users/:id", module: "admin-users", eventType: "delete", summary: "Xóa người dùng" }, // [MỚI]
    { method: "POST", pattern: "/admin/users", module: "admin-users", eventType: "create", summary: "Tạo người dùng mới" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/users/:id/roles/:roleId", module: "admin-users", eventType: "edit", summary: "Gỡ vai trò khỏi người dùng" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/users/:id/status", module: "admin-users", eventType: "edit", summary: "Cập nhật trạng thái người dùng" }, // [MỚI]
    { method: "PUT", pattern: "/admin/users/:id/reset-password", module: "admin-users", eventType: "edit", summary: "Đặt lại mật khẩu người dùng" }, // [MỚI]
    { method: "GET", pattern: "/admin/users/template", module: "admin-users", eventType: "export", summary: "Tải mẫu nhập người dùng" }, // [MỚI]
    { method: "GET", pattern: "/admin/users/export", module: "admin-users", eventType: "export", summary: "Xuất người dùng ra Excel" }, // [MỚI]
    { method: "POST", pattern: "/admin/users/import", module: "admin-users", eventType: "import", summary: "Nhập người dùng từ Excel" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - PERMISSIONS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/permissions", module: "admin-permissions", eventType: "view", summary: "Xem danh mục quyền hệ thống" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - ROLES
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/roles", module: "admin-roles", eventType: "view", summary: "Xem danh sách vai trò" }, // [MỚI]
    { method: "POST", pattern: "/admin/roles", module: "admin-roles", eventType: "create", summary: "Tạo vai trò mới" }, // [MỚI]
    { method: "GET", pattern: "/admin/roles/:id/permissions", module: "roles", eventType: "view", summary: "Xem quyền của vai trò" }, // [CŨ]
    { method: "PUT", pattern: "/admin/roles/:id/permissions", module: "admin-roles", eventType: "edit", summary: "Cập nhật quyền của vai trò" }, // [MỚI]
    { method: "GET", pattern: "/admin/roles/:id", module: "admin-roles", eventType: "view", summary: "Xem chi tiết vai trò" }, // [MỚI]
    { method: "PUT", pattern: "/admin/roles/:id", module: "admin-roles", eventType: "edit", summary: "Cập nhật vai trò" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/roles/:id", module: "admin-roles", eventType: "delete", summary: "Xóa vai trò" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - AUDIT LOGS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/audit-logs", module: "audit-log", eventType: "view", summary: "Xem lịch sử thao tác hệ thống" }, // [CŨ]
    { method: "GET", pattern: "/admin/audit-logs/filter-options", module: "audit-log", eventType: "view", summary: "Xem tùy chọn lọc nhật ký" }, // [MỚI]
    { method: "GET", pattern: "/admin/audit-logs/export", module: "audit-log", eventType: "export", summary: "Xuất nhật ký thao tác" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/audit-logs/bulk", module: "audit-log", eventType: "delete", summary: "Xóa hàng loạt nhật ký" }, // [MỚI]
    { method: "GET", pattern: "/admin/audit-logs/:id", module: "audit-log", eventType: "view", summary: "Xem chi tiết nhật ký" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/audit-logs/:id", module: "audit-log", eventType: "delete", summary: "Xóa nhật ký" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - AUDIT LOG CONFIG
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/audit-log-config", module: "audit-log-config", eventType: "view", summary: "Xem cấu hình nhật ký" }, // [CŨ]
    { method: "PUT", pattern: "/admin/audit-log-config", module: "audit-log-config", eventType: "edit", summary: "Cập nhật cấu hình nhật ký" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - METADATA TEMPLATES
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/metadata-templates", module: "metadata", eventType: "view", summary: "Xem danh sách mẫu metadata" }, // [CŨ]
    { method: "GET", pattern: "/admin/metadata-templates/:id", module: "metadata", eventType: "view", summary: "Xem chi tiết mẫu metadata" }, // [CŨ]
    { method: "GET", pattern: "/admin/metadata-templates/dossier-options", module: "metadata", eventType: "view", summary: "Xem danh sách hồ sơ OCR cho mẫu" }, // [MỚI]
    { method: "POST", pattern: "/admin/metadata-templates", module: "metadata", eventType: "create", summary: "Tạo mẫu metadata từ hồ sơ OCR" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/metadata-templates/:id", module: "metadata", eventType: "edit", summary: "Cập nhật mẫu metadata" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/metadata-templates/:id", module: "metadata", eventType: "delete", summary: "Xóa mẫu metadata" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/metadata-templates/:id/toggle-active", module: "metadata", eventType: "edit", summary: "Bật/tắt mẫu metadata" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - METADATA PERMISSION CONFIGS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/metadata-permission-configs/template-options", module: "metadata-permission", eventType: "view", summary: "Xem mẫu cho cấu hình phân quyền" }, // [MỚI]
    { method: "GET", pattern: "/admin/metadata-permission-configs/options", module: "metadata-permission", eventType: "view", summary: "Xem cấu hình phân quyền sẵn sàng" }, // [MỚI]
    { method: "GET", pattern: "/admin/metadata-permission-configs", module: "metadata-permission", eventType: "view", summary: "Xem danh sách cấu hình phân quyền metadata" }, // [MỚI]
    { method: "POST", pattern: "/admin/metadata-permission-configs", module: "metadata-permission", eventType: "create", summary: "Tạo cấu hình phân quyền metadata" }, // [MỚI]
    { method: "GET", pattern: "/admin/metadata-permission-configs/:id", module: "metadata-permission", eventType: "view", summary: "Xem chi tiết cấu hình phân quyền" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/metadata-permission-configs/:id", module: "metadata-permission", eventType: "edit", summary: "Cập nhật cấu hình phân quyền" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/metadata-permission-configs/:id", module: "metadata-permission", eventType: "delete", summary: "Xóa cấu hình phân quyền" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/metadata-permission-configs/:id/status", module: "metadata-permission", eventType: "edit", summary: "Đổi trạng thái cấu hình phân quyền" }, // [MỚI]
    { method: "PUT", pattern: "/admin/metadata-permission-configs/:id/slots", module: "metadata-permission", eventType: "edit", summary: "Thiết lập vị trí phân quyền metadata" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - METADATA EXPORT PRESETS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/metadata-export-presets/export-options", module: "metadata-export", eventType: "view", summary: "Xem tùy chọn preset xuất metadata" }, // [MỚI]
    { method: "GET", pattern: "/admin/metadata-export-presets", module: "metadata-export", eventType: "view", summary: "Xem danh sách preset xuất metadata" }, // [MỚI]
    { method: "POST", pattern: "/admin/metadata-export-presets", module: "metadata-export", eventType: "create", summary: "Tạo preset xuất metadata" }, // [MỚI]
    { method: "GET", pattern: "/admin/metadata-export-presets/:id", module: "metadata-export", eventType: "view", summary: "Xem chi tiết preset xuất metadata" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/metadata-export-presets/:id", module: "metadata-export", eventType: "edit", summary: "Cập nhật preset xuất metadata" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/metadata-export-presets/:id", module: "metadata-export", eventType: "delete", summary: "Xóa preset xuất metadata" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - GROUPS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/groups", module: "groups", eventType: "view", summary: "Xem danh sách nhóm" }, // [CŨ]
    { method: "GET", pattern: "/admin/groups/:id", module: "groups", eventType: "view", summary: "Xem chi tiết nhóm" }, // [CŨ]
    { method: "POST", pattern: "/admin/groups", module: "groups", eventType: "create", summary: "Tạo nhóm biên tập" }, // [MỚI]
    { method: "GET", pattern: "/admin/groups/available-editors", module: "groups", eventType: "view", summary: "Xem biên tập viên chưa thuộc nhóm" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/groups/:id", module: "groups", eventType: "edit", summary: "Cập nhật nhóm" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/groups/:id", module: "groups", eventType: "delete", summary: "Xóa nhóm" }, // [MỚI]
    { method: "POST", pattern: "/admin/groups/:id/assign-by-folder", module: "groups", eventType: "assign", summary: "Phân công hồ sơ theo thư mục cho nhóm" }, // [MỚI]
    { method: "POST", pattern: "/admin/groups/:id/revoke-by-folder", module: "groups", eventType: "revoke", summary: "Thu hồi phân công theo thư mục" }, // [MỚI]
    { method: "POST", pattern: "/admin/groups/:id/assign-by-folder/continue", module: "groups", eventType: "assign", summary: "Tiếp tục phân công từ hàng đợi" }, // [MỚI]
    { method: "POST", pattern: "/admin/groups/:id/sync-qc-workflow", module: "groups", eventType: "sync", summary: "Đồng bộ quy trình QC nhóm" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/groups/:id/metadata-permission-config", module: "groups", eventType: "edit", summary: "Gán cấu hình phân quyền metadata cho nhóm" }, // [MỚI]
    { method: "GET", pattern: "/admin/groups/:id/metadata-permission", module: "groups", eventType: "view", summary: "Xem phân quyền metadata của nhóm" }, // [MỚI]
    { method: "PUT", pattern: "/admin/groups/:id/permission-assignments", module: "groups", eventType: "edit", summary: "Gán biên tập viên vào vị trí phân quyền" }, // [MỚI]
    { method: "GET", pattern: "/admin/groups/:id/folder-queue", module: "groups", eventType: "view", summary: "Xem hàng đợi thư mục nhóm" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - PROJECTS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/projects", module: "projects", eventType: "view", summary: "Xem danh sách dự án" }, // [CŨ]
    { method: "GET", pattern: "/admin/projects/:id", module: "projects", eventType: "view", summary: "Xem chi tiết dự án" }, // [CŨ]
    { method: "POST", pattern: "/admin/projects", module: "projects", eventType: "create", summary: "Tạo dự án mới" }, // [MỚI]
    { method: "GET", pattern: "/admin/projects/options", module: "projects", eventType: "view", summary: "Xem tùy chọn dự án" }, // [MỚI]
    { method: "GET", pattern: "/admin/projects/:projectCode", module: "projects", eventType: "view", summary: "Xem chi tiết dự án" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/projects/:projectCode", module: "projects", eventType: "edit", summary: "Cập nhật dự án" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/projects/:projectCode", module: "projects", eventType: "delete", summary: "Xóa dự án" }, // [MỚI]
    { method: "GET", pattern: "/admin/projects/:projectCode/progress-history", module: "projects", eventType: "view", summary: "Xem lịch sử tiến độ dự án" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - ISSUE REPORTS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/issue-reports", module: "issue-reports", eventType: "view", summary: "Xem danh sách vấn đề chuyển tiếp" }, // [MỚI]
    { method: "POST", pattern: "/admin/issue-reports/:reportId/close", module: "issue-reports", eventType: "close", summary: "Đóng vấn đề đã xử lý" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - DASHBOARD
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/dashboard", module: "admin-dashboard", eventType: "view", summary: "Xem thống kê bảng điều khiển admin" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - ARCHIVE FIELD CONFIGS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/archive-field-configs", module: "archive-field-configs", eventType: "view", summary: "Xem cấu hình trường lưu kho" }, // [MỚI]
    { method: "POST", pattern: "/admin/archive-field-configs", module: "archive-field-configs", eventType: "create", summary: "Tạo cấu hình trường lưu kho" }, // [MỚI]
    { method: "PUT", pattern: "/admin/archive-field-configs/reorder", module: "archive-field-configs", eventType: "edit", summary: "Sắp xếp lại thứ tự trường lưu kho" }, // [MỚI]
    { method: "PUT", pattern: "/admin/archive-field-configs/:id", module: "archive-field-configs", eventType: "edit", summary: "Cập nhật cấu hình trường lưu kho" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/archive-field-configs/:id", module: "archive-field-configs", eventType: "delete", summary: "Vô hiệu hóa cấu hình trường lưu kho" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - ARCHIVE ACL
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/archive-acl/matrix", module: "archive", eventType: "view", summary: "Xem ma trận ACL kho" }, // [CŨ]
    { method: "GET", pattern: "/admin/archive-acl/catalog", module: "archive-acl", eventType: "view", summary: "Xem danh sách user/role gán ACL" }, // [MỚI]
    { method: "PUT", pattern: "/admin/archive-acl/principals", module: "archive-acl", eventType: "edit", summary: "Gán principals cho quyền trên resource" }, // [MỚI]
    { method: "POST", pattern: "/admin/archive-acl/apply-all-permissions", module: "archive-acl", eventType: "edit", summary: "Áp dụng tất cả quyền warehouse" }, // [MỚI]
    { method: "GET", pattern: "/admin/archive-acl/metadata-view", module: "archive-acl", eventType: "view", summary: "Xem danh sách loại tài liệu cho tab Metadata" }, // [MỚI]
    { method: "GET", pattern: "/admin/archive-acl/metadata-view/:documentTypeId", module: "archive-acl", eventType: "view", summary: "Xem ma trận phân quyền trường metadata" }, // [MỚI]
    { method: "PUT", pattern: "/admin/archive-acl/metadata-view/:documentTypeId", module: "archive-acl", eventType: "edit", summary: "Lưu ma trận phân quyền trường metadata" }, // [MỚI]
    { method: "POST", pattern: "/admin/archive-acl/metadata-view/:documentTypeId/assign-all", module: "archive-acl", eventType: "edit", summary: "Gán tất cả trường vào cột phân quyền" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - NOTIFICATION CONFIGS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/notification-configs", module: "notification-configs", eventType: "view", summary: "Xem danh sách cấu hình thông báo" }, // [MỚI]
    { method: "POST", pattern: "/admin/notification-configs", module: "notification-configs", eventType: "create", summary: "Tạo cấu hình thông báo" }, // [MỚI]
    { method: "GET", pattern: "/admin/notification-configs/email-sender", module: "notification-configs", eventType: "view", summary: "Xem cấu hình gửi email" }, // [MỚI]
    { method: "PUT", pattern: "/admin/notification-configs/email-sender", module: "notification-configs", eventType: "edit", summary: "Cập nhật cấu hình gửi email" }, // [MỚI]
    { method: "POST", pattern: "/admin/notification-configs/email-sender/test-send", module: "notification-configs", eventType: "test", summary: "Gửi email thử nghiệm" }, // [MỚI]
    { method: "GET", pattern: "/admin/notification-configs/:id", module: "notification-configs", eventType: "view", summary: "Xem chi tiết cấu hình thông báo" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/notification-configs/:id", module: "notification-configs", eventType: "edit", summary: "Cập nhật cấu hình thông báo" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/notification-configs/:id", module: "notification-configs", eventType: "delete", summary: "Xóa cấu hình thông báo" }, // [MỚI]
    { method: "POST", pattern: "/admin/notification-configs/:id/activate", module: "notification-configs", eventType: "activate", summary: "Kích hoạt cấu hình thông báo" }, // [MỚI]
    { method: "POST", pattern: "/admin/notification-configs/:id/deactivate", module: "notification-configs", eventType: "deactivate", summary: "Vô hiệu hóa cấu hình thông báo" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - WATERMARK
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/watermark/images", module: "watermark", eventType: "view", summary: "Xem thư viện ảnh watermark" }, // [MỚI]
    { method: "POST", pattern: "/admin/watermark/images", module: "watermark", eventType: "upload", summary: "Tải ảnh watermark lên" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/watermark/images/:assetId", module: "watermark", eventType: "delete", summary: "Xóa ảnh watermark" }, // [MỚI]
    { method: "GET", pattern: "/admin/watermark/placements", module: "watermark", eventType: "view", summary: "Xem danh sách vị trí watermark" }, // [MỚI]
    { method: "POST", pattern: "/admin/watermark/placements", module: "watermark", eventType: "create", summary: "Tạo vị trí watermark" }, // [MỚI]
    { method: "GET", pattern: "/admin/watermark/placements/:id", module: "watermark", eventType: "view", summary: "Xem chi tiết vị trí watermark" }, // [MỚI]
    { method: "PUT", pattern: "/admin/watermark/placements/:id", module: "watermark", eventType: "edit", summary: "Cập nhật vị trí watermark" }, // [MỚI]
    { method: "DELETE", pattern: "/admin/watermark/placements/:id", module: "watermark", eventType: "delete", summary: "Xóa vị trí watermark" }, // [MỚI]
    { method: "PATCH", pattern: "/admin/watermark/placements/:id/active", module: "watermark", eventType: "edit", summary: "Bật/tắt vị trí watermark" }, // [MỚI]
    { method: "GET", pattern: "/admin/watermark/pdf-security", module: "watermark", eventType: "view", summary: "Xem cấu hình bảo mật PDF" }, // [MỚI]
    { method: "PUT", pattern: "/admin/watermark/pdf-security", module: "watermark", eventType: "edit", summary: "Cập nhật bảo mật PDF" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ADMIN - DOCUMENT NAMING CONFIGS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/admin/document-naming-configs/field-catalog", module: "document-naming", eventType: "view", summary: "Xem danh mục trường đặt tên" }, // [MỚI]
    { method: "GET", pattern: "/admin/document-naming-configs/dossier-options", module: "document-naming", eventType: "view", summary: "Xem hồ sơ trong phông cho đặt tên" }, // [MỚI]
    { method: "GET", pattern: "/admin/document-naming-configs", module: "document-naming", eventType: "view", summary: "Xem cấu hình đặt tên tài liệu" }, // [MỚI]
    { method: "PUT", pattern: "/admin/document-naming-configs", module: "document-naming", eventType: "edit", summary: "Tạo/cập nhật cấu hình đặt tên" }, // [MỚI]
    { method: "POST", pattern: "/admin/document-naming-configs/preview", module: "document-naming", eventType: "preview", summary: "Xem trước tên tạo từ quy tắc" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: USERS PROFILE
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/users/profile", module: "user-profile", eventType: "view", summary: "Xem hồ sơ cá nhân" }, // [MỚI]
    { method: "PUT", pattern: "/users/profile", module: "user-profile", eventType: "edit", summary: "Cập nhật hồ sơ cá nhân" }, // [MỚI]
    { method: "PUT", pattern: "/users/profile/download-password", module: "user-profile", eventType: "edit", summary: "Cập nhật mật khẩu tải xuống" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: DOSSIERS (Hồ sơ)
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/dossiers", module: "dossiers", eventType: "view", summary: "Xem danh sách hồ sơ" }, // [MỚI]
    { method: "POST", pattern: "/dossiers", module: "dossiers", eventType: "create", summary: "Tạo hồ sơ mới" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/check-file-path", module: "dossiers", eventType: "view", summary: "Kiểm tra đường dẫn file" }, // [MỚI]
    { method: "POST", pattern: "/dossiers/create-upload-point", module: "dossiers", eventType: "create", summary: "Tạo điểm tải lên S3" }, // [MỚI]
    { method: "POST", pattern: "/dossiers/create-document-from-storage", module: "dossiers", eventType: "create", summary: "Đăng ký tài liệu từ S3" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/ocr-control/pending-manual", module: "dossiers", eventType: "view", summary: "Xem hồ sơ chờ kích hoạt OCR" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/ocr-control/tracked", module: "dossiers", eventType: "view", summary: "Xem hồ sơ OCR đang xử lý" }, // [MỚI]
    { method: "POST", pattern: "/dossiers/ocr-control/trigger", module: "dossiers", eventType: "trigger", summary: "Kích hoạt OCR thủ công" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/assignments/by-role", module: "dossiers", eventType: "view", summary: "Xem phân công theo vai trò" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/assignments/drafts", module: "dossiers", eventType: "view", summary: "Xem danh sách bản nháp" }, // [MỚI]
    { method: "POST", pattern: "/dossiers/assignments/drafts/submit", module: "data-entry", eventType: "edit", summary: "Gửi/duyệt hàng loạt hồ sơ nháp" }, // [CŨ]
    { method: "POST", pattern: "/dossiers/assign-by-folder", module: "dossiers", eventType: "assign", summary: "Phân công hồ sơ theo thư mục" }, // [MỚI]
    { method: "POST", pattern: "/dossiers/metadata/export", module: "dossiers", eventType: "export", summary: "Xuất metadata nhiều hồ sơ" }, // [MỚI]
    { method: "POST", pattern: "/dossiers/dip/export", module: "dossiers", eventType: "export", summary: "Xuất gói DIP nhiều hồ sơ" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/:id", module: "dossiers", eventType: "view", summary: "Xem chi tiết hồ sơ" }, // [MỚI]
    { method: "PUT", pattern: "/dossiers/:id", module: "dossiers", eventType: "edit", summary: "Cập nhật hồ sơ" }, // [MỚI]
    { method: "DELETE", pattern: "/dossiers/:id", module: "dossiers", eventType: "delete", summary: "Xóa hồ sơ" }, // [MỚI]
    { method: "POST", pattern: "/dossiers/:id/verify-access", module: "dossiers", eventType: "verify", summary: "Xác thực mật khẩu truy cập hồ sơ" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/:id/dip/export", module: "dossiers", eventType: "export", summary: "Xuất gói DIP hồ sơ" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/:id/aip/status", module: "dossiers", eventType: "view", summary: "Xem trạng thái gói AIP" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/:id/metadata/export/fields", module: "dossiers", eventType: "view", summary: "Xem trường metadata xuất được" }, // [MỚI]
    { method: "POST", pattern: "/dossiers/:id/metadata/export/preview", module: "dossiers", eventType: "preview", summary: "Xem trước xuất metadata hồ sơ" }, // [MỚI]
    { method: "POST", pattern: "/dossiers/:id/metadata/export", module: "dossiers", eventType: "export", summary: "Xuất metadata hồ sơ" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/:id/metadata/export", module: "dossiers", eventType: "export", summary: "Xuất metadata hồ sơ ra Excel" }, // [MỚI]
    { method: "PUT", pattern: "/dossiers/:id/metadata/draft", module: "dossiers", eventType: "edit", summary: "Lưu nháp metadata" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/:id/metadata/draft", module: "dossiers", eventType: "view", summary: "Xem nháp metadata" }, // [MỚI]
    { method: "PUT", pattern: "/dossiers/:id/metadata", module: "data-entry", eventType: "edit", summary: "Gửi biên tập hồ sơ" }, // [CŨ]
    { method: "POST", pattern: "/dossiers/:id/assign", module: "dossiers", eventType: "assign", summary: "Phân công hồ sơ cho người dùng" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/:id/prepare", module: "data-entry", eventType: "view", summary: "Chuẩn bị form nộp lưu kho" }, // [CŨ]
    { method: "GET", pattern: "/dossiers/:id/metadata-history", module: "data-entry", eventType: "view", summary: "Xem lịch sử metadata của hồ sơ" }, // [CŨ]
    { method: "GET", pattern: "/dossiers/:id/metadata-history/:historyId", module: "dossiers", eventType: "view", summary: "Xem chi tiết phiên bản metadata" }, // [MỚI]
    { method: "POST", pattern: "/dossiers/:id/metadata-history/:historyId/restore", module: "dossiers", eventType: "restore", summary: "Khôi phục phiên bản metadata cũ" }, // [MỚI]
    { method: "GET", pattern: "/dossiers/:id/workflow-logs", module: "dossiers", eventType: "view", summary: "Xem lịch sử workflow hồ sơ" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: SCAN INTAKE
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/scan-intake/sessions", module: "scan-intake", eventType: "view", summary: "Xem danh sách phiên scan" }, // [CŨ]
    { method: "GET", pattern: "/scan-intake/session", module: "scan-intake", eventType: "view", summary: "Xem chi tiết phiên scan" }, // [CŨ]
    { method: "POST", pattern: "/scan-intake/upload-point", module: "scan-intake", eventType: "create", summary: "Tạo URL tải lên scan" }, // [MỚI]
    { method: "POST", pattern: "/scan-intake/presigned-get", module: "scan-intake", eventType: "view", summary: "Tạo URL tải xuống scan" }, // [MỚI]
    { method: "POST", pattern: "/scan-intake/assemble-pdf", module: "scan-intake", eventType: "create", summary: "Ghép trang thành PDF" }, // [MỚI]
    { method: "POST", pattern: "/scan-intake/pages/reorder", module: "scan-intake", eventType: "edit", summary: "Sắp xếp lại trang scan" }, // [MỚI]
    { method: "POST", pattern: "/scan-intake/pages/delete", module: "scan-intake", eventType: "delete", summary: "Xóa trang scan" }, // [MỚI]
    { method: "POST", pattern: "/scan-intake/pages/delete-bulk", module: "scan-intake", eventType: "delete", summary: "Xóa hàng loạt trang scan" }, // [MỚI]
    { method: "POST", pattern: "/scan-intake/document/delete", module: "scan-intake", eventType: "delete", summary: "Xóa tài liệu scan" }, // [MỚI]
    { method: "POST", pattern: "/scan-intake/organize-move", module: "scan-intake", eventType: "edit", summary: "Di chuyển PDF giữa thư mục scan" }, // [MỚI]
    { method: "POST", pattern: "/scan-intake/organize-rename-folder", module: "scan-intake", eventType: "edit", summary: "Đổi tên thư mục scan" }, // [MỚI]
    { method: "POST", pattern: "/scan-intake/organize-rename-pdf", module: "scan-intake", eventType: "edit", summary: "Đổi tên file PDF scan" }, // [MỚI]
    { method: "POST", pattern: "/scan-intake/promote", module: "scan-intake", eventType: "promote", summary: "Đẩy PDF vào raw và đăng ký DB" }, // [CŨ - đã có label promote]
    { method: "POST", pattern: "/scan-intake/session/delete", module: "scan-intake", eventType: "delete", summary: "Xóa phiên scan" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: DIGITAL SIGN
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/digital-sign/status/:dossierId", module: "digital-sign", eventType: "view", summary: "Xem trạng thái ký số hồ sơ" }, // [CŨ - sửa typo từ dosauthsierId]
    { method: "GET", pattern: "/digital-sign/history/:dossierId", module: "digital-sign", eventType: "view", summary: "Xem lịch sử ký số hồ sơ" }, // [CŨ]
    { method: "POST", pattern: "/digital-sign/prepare", module: "digital-sign", eventType: "prepare", summary: "Chuẩn bị ký số hồ sơ" }, // [MỚI]
    { method: "POST", pattern: "/digital-sign/batch/prepare", module: "digital-sign", eventType: "prepare", summary: "Chuẩn bị ký số hàng loạt" }, // [MỚI]
    { method: "POST", pattern: "/digital-sign/submit", module: "digital-sign", eventType: "submit", summary: "Gửi chữ ký số cho file PDF" }, // [MỚI]
    { method: "POST", pattern: "/digital-sign/batch/submit", module: "digital-sign", eventType: "submit", summary: "Gửi chữ ký số hàng loạt" }, // [MỚI]
    { method: "POST", pattern: "/digital-sign/verify/:fileId", module: "digital-sign", eventType: "verify", summary: "Xác minh chữ ký số trên file" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: FOLDERS (Thư mục)
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/folders", module: "folders", eventType: "view", summary: "Xem danh sách thư mục" }, // [CŨ]
    { method: "GET", pattern: "/folders/:id", module: "folders", eventType: "view", summary: "Xem chi tiết thư mục" }, // [CŨ]
    { method: "GET", pattern: "/folders/all-parent", module: "folders", eventType: "view", summary: "Xem cây thư mục cha" }, // [CŨ]
    { method: "GET", pattern: "/folders/:id/all-first-subfolders", module: "folders", eventType: "view", summary: "Xem danh sách thư mục con" }, // [CŨ]
    { method: "POST", pattern: "/folders", module: "folders", eventType: "create", summary: "Tạo thư mục mới" }, // [MỚI]
    { method: "PUT", pattern: "/folders/:id", module: "folders", eventType: "edit", summary: "Cập nhật thư mục" }, // [MỚI]
    { method: "DELETE", pattern: "/folders/:id", module: "folders", eventType: "delete", summary: "Xóa thư mục" }, // [MỚI]
    { method: "GET", pattern: "/folders/dossiers/:dossierId/files", module: "folders", eventType: "view", summary: "Xem danh sách file hồ sơ" }, // [MỚI]
    { method: "PUT", pattern: "/folders/dossiers/:dossierId/metadata", module: "folders", eventType: "edit", summary: "Lưu metadata hồ sơ" }, // [MỚI]
    { method: "GET", pattern: "/folders/dossiers/:dossierId/metadata", module: "folders", eventType: "view", summary: "Xem nháp metadata hồ sơ" }, // [MỚI]
    { method: "PUT", pattern: "/folders/dossiers/:dossierId/metadata/summary", module: "folders", eventType: "edit", summary: "Lưu metadata tóm tắt hồ sơ" }, // [MỚI]
    { method: "POST", pattern: "/folders/metadata/export", module: "folders", eventType: "export", summary: "Xuất metadata nhiều thư mục" }, // [MỚI]
    { method: "POST", pattern: "/folders/metadata/export/preview", module: "folders", eventType: "preview", summary: "Xem trước xuất metadata thư mục" }, // [MỚI]
    { method: "GET", pattern: "/folders/:id/metadata/export/fields", module: "folders", eventType: "view", summary: "Xem trường metadata xuất thư mục" }, // [MỚI]
    { method: "POST", pattern: "/folders/:id/metadata/export/preview", module: "folders", eventType: "preview", summary: "Xem trước xuất metadata thư mục" }, // [MỚI]
    { method: "POST", pattern: "/folders/:id/metadata/export", module: "folders", eventType: "export", summary: "Xuất metadata thư mục" }, // [MỚI]
    { method: "GET", pattern: "/folders/:id/metadata/export", module: "folders", eventType: "export", summary: "Xuất bộ hồ sơ metadata ZIP" }, // [MỚI]
    { method: "PUT", pattern: "/folders/:id/project", module: "folders", eventType: "edit", summary: "Gán dự án cho thư mục" }, // [MỚI]
    { method: "POST", pattern: "/folders/:id/revoke-assignments", module: "folders", eventType: "revoke", summary: "Thu hồi phân công theo thư mục" }, // [MỚI]
    { method: "DELETE", pattern: "/folders/:id/dossiers", module: "folders", eventType: "delete", summary: "Xóa tất cả hồ sơ trong thư mục" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: FONDS (Phông lưu trữ)
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/fonds", module: "fonds", eventType: "view", summary: "Xem danh sách phông lưu trữ" }, // [CŨ]
    { method: "GET", pattern: "/fonds/:id", module: "fonds", eventType: "view", summary: "Xem chi tiết phông lưu trữ" }, // [CŨ]
    { method: "POST", pattern: "/fonds", module: "fonds", eventType: "create", summary: "Tạo phông lưu trữ mới" }, // [MỚI]
    { method: "GET", pattern: "/fonds/active", module: "fonds", eventType: "view", summary: "Xem phông đang hoạt động" }, // [MỚI]
    { method: "PUT", pattern: "/fonds/:id", module: "fonds", eventType: "edit", summary: "Cập nhật phông lưu trữ" }, // [MỚI]
    { method: "DELETE", pattern: "/fonds/:id", module: "fonds", eventType: "delete", summary: "Xóa phông lưu trữ" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: RETENTION PERIODS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/retention-periods", module: "retention-periods", eventType: "view", summary: "Xem danh sách thời hạn lưu trữ" }, // [CŨ]
    { method: "GET", pattern: "/retention-periods/:id", module: "retention-periods", eventType: "view", summary: "Xem chi tiết thời hạn lưu trữ" }, // [CŨ]
    { method: "POST", pattern: "/retention-periods", module: "retention-periods", eventType: "create", summary: "Tạo thời hạn lưu trữ mới" }, // [MỚI]
    { method: "GET", pattern: "/retention-periods/active", module: "retention-periods", eventType: "view", summary: "Xem thời hạn lưu trữ đang hoạt động" }, // [MỚI]
    { method: "PUT", pattern: "/retention-periods/:id", module: "retention-periods", eventType: "edit", summary: "Cập nhật thời hạn lưu trữ" }, // [MỚI]
    { method: "DELETE", pattern: "/retention-periods/:id", module: "retention-periods", eventType: "delete", summary: "Xóa thời hạn lưu trữ" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: INVENTORIES (Mục lục)
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/inventories", module: "inventories", eventType: "view", summary: "Xem danh sách mục lục" }, // [CŨ]
    { method: "GET", pattern: "/inventories/active", module: "inventories", eventType: "view", summary: "Xem mục lục đang hoạt động" }, // [CŨ]
    { method: "GET", pattern: "/inventories/:id", module: "inventories", eventType: "view", summary: "Xem chi tiết mục lục" }, // [CŨ]
    { method: "POST", pattern: "/inventories", module: "inventories", eventType: "create", summary: "Tạo mục lục mới" }, // [MỚI]
    { method: "PUT", pattern: "/inventories/:id", module: "inventories", eventType: "edit", summary: "Cập nhật mục lục" }, // [MỚI]
    { method: "DELETE", pattern: "/inventories/:id", module: "inventories", eventType: "delete", summary: "Xóa mục lục" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: DOSSIER TYPES (Loại hồ sơ)
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/dossier-types", module: "dossier-types", eventType: "view", summary: "Xem danh sách loại hồ sơ" }, // [CŨ]
    { method: "GET", pattern: "/dossier-types/:id", module: "dossier-types", eventType: "view", summary: "Xem chi tiết loại hồ sơ" }, // [CŨ]
    { method: "POST", pattern: "/dossier-types", module: "dossier-types", eventType: "create", summary: "Tạo loại hồ sơ mới" }, // [MỚI]
    { method: "GET", pattern: "/dossier-types/active", module: "dossier-types", eventType: "view", summary: "Xem loại hồ sơ đang hoạt động" }, // [MỚI]
    { method: "PUT", pattern: "/dossier-types/:id", module: "dossier-types", eventType: "edit", summary: "Cập nhật loại hồ sơ" }, // [MỚI]
    { method: "DELETE", pattern: "/dossier-types/:id", module: "dossier-types", eventType: "delete", summary: "Xóa loại hồ sơ" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: DOCUMENT TYPES (Loại tài liệu)
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/document-types", module: "document-types", eventType: "view", summary: "Xem danh sách loại tài liệu" }, // [CŨ]
    { method: "GET", pattern: "/document-types/:id", module: "document-types", eventType: "view", summary: "Xem chi tiết loại tài liệu" }, // [CŨ]
    { method: "POST", pattern: "/document-types", module: "document-types", eventType: "create", summary: "Tạo loại tài liệu mới" }, // [MỚI]
    { method: "PUT", pattern: "/document-types/:id", module: "document-types", eventType: "edit", summary: "Cập nhật loại tài liệu" }, // [MỚI]
    { method: "DELETE", pattern: "/document-types/:id", module: "document-types", eventType: "delete", summary: "Xóa loại tài liệu" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: PHYSICAL WAREHOUSE (Kho vật lý)
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/physical-warehouse/items", module: "physical-warehouse", eventType: "view", summary: "Xem danh sách mục kho vật lý" }, // [CŨ]
    { method: "GET", pattern: "/physical-warehouse/items/tree", module: "physical-warehouse", eventType: "view", summary: "Xem cây kho vật lý" }, // [CŨ]
    { method: "GET", pattern: "/physical-warehouse/items/stats", module: "physical-warehouse", eventType: "view", summary: "Xem thống kê kho vật lý" }, // [CŨ]
    { method: "GET", pattern: "/physical-warehouse/items/:id", module: "physical-warehouse", eventType: "view", summary: "Xem chi tiết mục kho vật lý" }, // [CŨ]
    { method: "GET", pattern: "/physical-warehouse/placements", module: "physical-warehouse", eventType: "view", summary: "Xem danh sách vị trí gắn hồ sơ" }, // [CŨ]
    { method: "GET", pattern: "/physical-warehouse/placements/unplaced", module: "physical-warehouse", eventType: "view", summary: "Xem hồ sơ chưa gắn vị trí kho vật lý" }, // [CŨ]
    { method: "POST", pattern: "/physical-warehouse/items", module: "physical-warehouse", eventType: "create", summary: "Tạo địa điểm/ô chứa kho vật lý" }, // [MỚI]
    { method: "PUT", pattern: "/physical-warehouse/items/:id", module: "physical-warehouse", eventType: "edit", summary: "Cập nhật mục kho vật lý" }, // [MỚI]
    { method: "DELETE", pattern: "/physical-warehouse/items/:id", module: "physical-warehouse", eventType: "delete", summary: "Xóa mục kho vật lý" }, // [MỚI]
    { method: "GET", pattern: "/physical-warehouse/items/bottom-boxes", module: "physical-warehouse", eventType: "view", summary: "Xem danh sách ô chứa cấp cuối" }, // [MỚI]
    { method: "POST", pattern: "/physical-warehouse/items/:id/reparent", module: "physical-warehouse", eventType: "edit", summary: "Di chuyển ô chứa sang mục khác" }, // [MỚI]
    { method: "POST", pattern: "/physical-warehouse/placements", module: "physical-warehouse", eventType: "place", summary: "Xếp hồ sơ vào ô chứa" }, // [MỚI]
    { method: "POST", pattern: "/physical-warehouse/placements/move", module: "physical-warehouse", eventType: "move", summary: "Đổi vị trí kho vật lý" }, // [MỚI]
    { method: "POST", pattern: "/physical-warehouse/placements/remove", module: "physical-warehouse", eventType: "remove", summary: "Gỡ hồ sơ khỏi kho vật lý" }, // [MỚI]
    { method: "POST", pattern: "/physical-warehouse/upload-image", module: "physical-warehouse", eventType: "upload", summary: "Tải ảnh kho vật lý lên S3" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: DATA ENTRY
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/data-entry/maker/claim", module: "data-entry", eventType: "view", summary: "Nhận hồ sơ biên tập" }, // [CŨ]
    { method: "GET", pattern: "/data-entry/maker/dossiers/:id", module: "data-entry", eventType: "view", summary: "Xem hồ sơ đang biên tập" }, // [CŨ]
    { method: "POST", pattern: "/data-entry/checker/approve/:id", module: "data-entry", eventType: "approve", summary: "Duyệt biên tập hồ sơ" }, // [CŨ]
    { method: "POST", pattern: "/data-entry/checker/reject/:id", module: "data-entry", eventType: "reject", summary: "Từ chối biên tập hồ sơ" }, // [CŨ]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ISSUE REPORTS (User-side)
    // ═══════════════════════════════════════════════════════════
    { method: "POST", pattern: "/issue-reports/:id/confirm", module: "issue-reports", eventType: "confirm", summary: "Xác nhận thông báo vấn đề tài liệu" }, // [CŨ]
    { method: "POST", pattern: "/issue-reports/:id/reject", module: "issue-reports", eventType: "reject", summary: "Từ chối thông báo vấn đề tài liệu" }, // [CŨ]
    { method: "POST", pattern: "/issue-reports/:id/escalate", module: "issue-reports", eventType: "escalate", summary: "Chuyển tiếp thông báo vấn đề tới quản lý dự án" }, // [CŨ]
    { method: "GET", pattern: "/issue-reports/dossier/:dossierId", module: "issue-reports", eventType: "view", summary: "Xem thông báo vấn đề của hồ sơ" }, // [CŨ]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: DASHBOARD (User-side)
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/dashboard/editor", module: "dashboard", eventType: "view", summary: "Xem thống kê biên tập viên" }, // [MỚI]
    { method: "GET", pattern: "/dashboard/qc", module: "dashboard", eventType: "view", summary: "Xem thống kê QC" }, // [MỚI]
    { method: "GET", pattern: "/dashboard/qc/group", module: "dashboard", eventType: "view", summary: "Xem thống kê nhóm QC" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: INTERNAL
    // ═══════════════════════════════════════════════════════════
    { method: "POST", pattern: "/internal/ocr-callback", module: "internal", eventType: "callback", summary: "Nhận callback OCR từ worker" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: METADATA EXTRACT
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/metadata/extract-settings", module: "metadata-extract", eventType: "view", summary: "Xem cấu hình trích xuất metadata" }, // [MỚI]
    { method: "PUT", pattern: "/metadata/extract-settings", module: "metadata-extract", eventType: "edit", summary: "Cập nhật chế độ trích xuất metadata" }, // [MỚI]
    { method: "POST", pattern: "/metadata/extract", module: "metadata-extract", eventType: "trigger", summary: "Kích hoạt trích xuất metadata" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: PROJECT PLANS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/project-plans", module: "project-plans", eventType: "view", summary: "Xem kế hoạch dự án" }, // [CŨ - sửa thiếu /]
    { method: "GET", pattern: "/project-plans/:id", module: "project-plans", eventType: "view", summary: "Xem chi tiết kế hoạch dự án" }, // [CŨ - sửa thiếu /]
    { method: "GET", pattern: "/project-plans/:id/detail", module: "project-plans", eventType: "view", summary: "Xem chi tiết kế hoạch dự án" }, // [CŨ - sửa từ details → detail]
    { method: "POST", pattern: "/project-plans", module: "project-plans", eventType: "create", summary: "Tạo kế hoạch dự án" }, // [MỚI]
    { method: "PATCH", pattern: "/project-plans/:id", module: "project-plans", eventType: "edit", summary: "Cập nhật kế hoạch dự án" }, // [MỚI]
    { method: "DELETE", pattern: "/project-plans/:id", module: "project-plans", eventType: "delete", summary: "Xóa kế hoạch dự án" }, // [MỚI]
    { method: "PUT", pattern: "/project-plans/:id/detail", module: "project-plans", eventType: "edit", summary: "Cập nhật chi tiết kế hoạch dự án" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: PAPER SIZES
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/paper-sizes", module: "paper-sizes", eventType: "view", summary: "Xem danh sách khổ giấy" }, // [MỚI]
    { method: "POST", pattern: "/paper-sizes", module: "paper-sizes", eventType: "create", summary: "Tạo khổ giấy mới" }, // [MỚI]
    { method: "GET", pattern: "/paper-sizes/:id", module: "paper-sizes", eventType: "view", summary: "Xem chi tiết khổ giấy" }, // [MỚI]
    { method: "PATCH", pattern: "/paper-sizes/:id", module: "paper-sizes", eventType: "edit", summary: "Cập nhật khổ giấy" }, // [MỚI]
    { method: "DELETE", pattern: "/paper-sizes/:id", module: "paper-sizes", eventType: "delete", summary: "Xóa khổ giấy" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: PAPER PLANS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/paper-plans", module: "paper-plans", eventType: "view", summary: "Xem danh sách kế hoạch giấy" }, // [MỚI]
    { method: "POST", pattern: "/paper-plans", module: "paper-plans", eventType: "create", summary: "Tạo kế hoạch giấy" }, // [MỚI]
    { method: "GET", pattern: "/paper-plans/:id", module: "paper-plans", eventType: "view", summary: "Xem kế hoạch giấy theo kế hoạch" }, // [MỚI]
    { method: "PATCH", pattern: "/paper-plans/:id", module: "paper-plans", eventType: "edit", summary: "Cập nhật số lượng kế hoạch giấy" }, // [MỚI]
    { method: "DELETE", pattern: "/paper-plans/:id", module: "paper-plans", eventType: "delete", summary: "Xóa kế hoạch giấy" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/notifications", module: "notifications", eventType: "view", summary: "Xem hộp thư thông báo" }, // [CŨ]
    { method: "GET", pattern: "/notifications/unread-count", module: "notifications", eventType: "view", summary: "Xem số thông báo chưa đọc" }, // [MỚI]
    { method: "POST", pattern: "/notifications/:id/read", module: "notifications", eventType: "edit", summary: "Đánh dấu thông báo đã đọc" }, // [MỚI]
    { method: "POST", pattern: "/notifications/read-all", module: "notifications", eventType: "edit", summary: "Đánh dấu tất cả thông báo đã đọc" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ARCHIVE SUBMISSIONS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/archive-submissions/pending", module: "archive", eventType: "view", summary: "Xem đơn nộp lưu kho chờ duyệt" }, // [CŨ]
    { method: "GET", pattern: "/archive-submissions/dossiers", module: "archive", eventType: "view", summary: "Xem hồ sơ trong quy trình lưu kho" }, // [CŨ]
    { method: "GET", pattern: "/archive-submissions/dossier/:id/prepare", module: "archive", eventType: "view", summary: "Chuẩn bị form nộp lưu kho" }, // [CŨ]
    { method: "POST", pattern: "/archive-submissions/physical-location/place", module: "archive", eventType: "place_physical", summary: "Xếp hồ sơ vào kho vật lý" }, // [CŨ]
    { method: "POST", pattern: "/archive-submissions/physical-location/move", module: "archive", eventType: "move_physical", summary: "Đổi vị trí kho vật lý" }, // [CŨ]
    { method: "POST", pattern: "/archive-submissions/physical-location/remove", module: "archive", eventType: "remove_physical", summary: "Gỡ hồ sơ khỏi kho vật lý" }, // [CŨ]
    { method: "GET", pattern: "/archive-submissions/field-configs", module: "archive-submissions", eventType: "view", summary: "Xem cấu hình trường nộp lưu kho" }, // [MỚI]
    { method: "GET", pattern: "/archive-submissions/physical-location/items", module: "archive-submissions", eventType: "view", summary: "Xem cascade vị trí kho" }, // [MỚI]
    { method: "GET", pattern: "/archive-submissions/physical-location/boxes", module: "archive-submissions", eventType: "view", summary: "Xem danh sách hộp kho" }, // [MỚI]
    { method: "GET", pattern: "/archive-submissions/physical-location/by-dossier/:dossierId", module: "archive-submissions", eventType: "view", summary: "Xem vị trí kho của hồ sơ" }, // [MỚI]
    { method: "GET", pattern: "/archive-submissions/dossier/:dossierId", module: "archive-submissions", eventType: "view", summary: "Xem lịch sử nộp lưu kho" }, // [MỚI]
    { method: "POST", pattern: "/archive-submissions/dossier/:dossierId", module: "archive-submissions", eventType: "submit", summary: "Nộp hồ sơ vào quy trình lưu kho" }, // [MỚI]
    { method: "GET", pattern: "/archive-submissions/:id", module: "archive-submissions", eventType: "view", summary: "Xem chi tiết đơn nộp lưu kho" }, // [MỚI]
    { method: "POST", pattern: "/archive-submissions/:id/approve", module: "archive-submissions", eventType: "approve", summary: "Duyệt đơn nộp lưu kho" }, // [MỚI]
    { method: "POST", pattern: "/archive-submissions/:id/reject", module: "archive-submissions", eventType: "reject", summary: "Từ chối đơn nộp lưu kho" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ARCHIVE WAREHOUSE
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/archive-warehouse/fonds", module: "archive", eventType: "view", summary: "Xem danh sách phông trong kho" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/dossier-types", module: "archive", eventType: "view", summary: "Xem danh sách loại hồ sơ trong kho" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/dossier-types/:id/summary", module: "archive", eventType: "view", summary: "Xem thống kê theo loại hồ sơ" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/document-types", module: "archive", eventType: "view", summary: "Xem danh sách loại tài liệu trong kho" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/document-types/:id/summary", module: "archive", eventType: "view", summary: "Xem thống kê theo loại tài liệu" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/fonds/:id/summary", module: "archive", eventType: "view", summary: "Xem thống kê theo phông" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/dossiers", module: "archive", eventType: "view", summary: "Duyệt hồ sơ đã lưu kho theo phông" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/dossiers/unassigned", module: "archive", eventType: "view", summary: "Xem hồ sơ đã lưu kho chưa thuộc phông" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/dossiers/by-dossier-type", module: "archive", eventType: "view", summary: "Duyệt hồ sơ đã lưu kho theo loại hồ sơ" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/documents/by-document-type", module: "archive", eventType: "view", summary: "Duyệt tài liệu đã lưu kho theo loại tài liệu" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/dossiers/:id", module: "archive", eventType: "view", summary: "Xem chi tiết hồ sơ trong kho" }, // [CŨ]
    { method: "GET", pattern: "/archive-warehouse/search", module: "archive", eventType: "view", summary: "Tìm kiếm trong kho lưu trữ" }, // [CŨ]
    { method: "PATCH", pattern: "/archive-warehouse/dossiers/:dossierId/files/:fileId/document-type", module: "archive-warehouse", eventType: "edit", summary: "Sửa loại tài liệu file đã lưu kho" }, // [MỚI]
    { method: "PATCH", pattern: "/archive-warehouse/dossiers/:dossierId/security", module: "archive-warehouse", eventType: "edit", summary: "Cập nhật bảo mật hồ sơ trong kho" }, // [MỚI]
    { method: "PATCH", pattern: "/archive-warehouse/dossiers/:dossierId/files/:fileId/security", module: "archive-warehouse", eventType: "edit", summary: "Cập nhật bảo mật file trong kho" }, // [MỚI]
    { method: "POST", pattern: "/archive-warehouse/dossiers/:dossierId/files/bulk-security", module: "archive-warehouse", eventType: "edit", summary: "Cập nhật bảo mật hàng loạt file" }, // [MỚI]
    { method: "GET", pattern: "/archive-warehouse/dossiers/:dossierId/files/:fileId/content", module: "archive-warehouse", eventType: "view", summary: "Xem/tải file hồ sơ kho" }, // [MỚI]
    { method: "POST", pattern: "/archive-warehouse/dossiers/:dossierId/files/:fileId/reupload-upload-point", module: "archive-warehouse", eventType: "create", summary: "Tạo điểm upload thay file kho" }, // [MỚI]
    { method: "POST", pattern: "/archive-warehouse/dossiers/:dossierId/files/:fileId/reupload", module: "archive-warehouse", eventType: "edit", summary: "Thay file và mở lại OCR" }, // [MỚI]
    { method: "DELETE", pattern: "/archive-warehouse/dossiers/:dossierId/files/:fileId", module: "archive-warehouse", eventType: "delete", summary: "Xóa file trong hồ sơ kho" }, // [MỚI]
    { method: "POST", pattern: "/archive-warehouse/dossiers/:dossierId/files/bulk-delete", module: "archive-warehouse", eventType: "delete", summary: "Xóa hàng loạt file hồ sơ kho" }, // [MỚI]
    { method: "POST", pattern: "/archive-warehouse/dossiers/:dossierId/files/:fileId/move", module: "archive-warehouse", eventType: "edit", summary: "Chuyển file sang hồ sơ khác" }, // [MỚI]
    { method: "POST", pattern: "/archive-warehouse/dossiers/:dossierId/files/bulk-move", module: "archive-warehouse", eventType: "edit", summary: "Chuyển hàng loạt file sang hồ sơ khác" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ARCHIVE EXPLOITATION
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/archive-exploitation/fonds", module: "archive-exploitation", eventType: "view", summary: "Xem phông trong kho khai thác" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/fonds/:fondId/summary", module: "archive-exploitation", eventType: "view", summary: "Thống kê hồ sơ khai thác theo phông" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/summary", module: "archive-exploitation", eventType: "view", summary: "Thống kê tổng hợp kho khai thác" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/dossier-types", module: "archive-exploitation", eventType: "view", summary: "Xem loại hồ sơ trong kho khai thác" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/dossier-types/:dossierTypeId/summary", module: "archive-exploitation", eventType: "view", summary: "Thống kê hồ sơ khai thác theo loại" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/document-types", module: "archive-exploitation", eventType: "view", summary: "Xem loại tài liệu trong kho khai thác" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/document-types/:documentTypeId/summary", module: "archive-exploitation", eventType: "view", summary: "Thống kê tài liệu khai thác theo loại" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/dossiers/unassigned", module: "archive-exploitation", eventType: "view", summary: "Xem hồ sơ khai thác chưa thuộc phông" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/dossiers/by-dossier-type", module: "archive-exploitation", eventType: "view", summary: "Duyệt hồ sơ khai thác theo loại" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/documents/by-document-type", module: "archive-exploitation", eventType: "view", summary: "Duyệt tài liệu khai thác theo loại" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/dossiers", module: "archive-exploitation", eventType: "view", summary: "Xem danh sách hồ sơ khai thác" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/search", module: "archive-exploitation", eventType: "view", summary: "Tìm kiếm trong kho khai thác" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/dossiers/:dossierId", module: "archive-exploitation", eventType: "view", summary: "Xem chi tiết hồ sơ khai thác" }, // [MỚI]
    { method: "GET", pattern: "/archive-exploitation/dossiers/:dossierId/files/:fileId/content", module: "archive-exploitation", eventType: "view", summary: "Xem file PDF trong kho khai thác" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ARCHIVE DISPOSAL
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/archive-disposal/candidates", module: "archive-disposal", eventType: "view", summary: "Xem hồ sơ hết hạn/sắp hết hạn/trùng lặp" }, // [MỚI]
    { method: "GET", pattern: "/archive-disposal/catalogs", module: "archive-disposal", eventType: "view", summary: "Xem danh mục đề xuất hủy" }, // [MỚI]
    { method: "POST", pattern: "/archive-disposal/catalogs", module: "archive-disposal", eventType: "create", summary: "Tạo danh mục đề xuất hủy" }, // [MỚI]
    { method: "GET", pattern: "/archive-disposal/catalogs/available-for-council", module: "archive-disposal", eventType: "view", summary: "Xem danh mục khả dụng gắn Hội đồng" }, // [MỚI]
    { method: "GET", pattern: "/archive-disposal/catalogs/:catalogId", module: "archive-disposal", eventType: "view", summary: "Xem chi tiết danh mục đề xuất hủy" }, // [MỚI]
    { method: "PATCH", pattern: "/archive-disposal/catalogs/:catalogId", module: "archive-disposal", eventType: "edit", summary: "Cập nhật danh mục đề xuất hủy" }, // [MỚI]
    { method: "DELETE", pattern: "/archive-disposal/catalogs/:catalogId", module: "archive-disposal", eventType: "delete", summary: "Xóa danh mục đề xuất hủy" }, // [MỚI]
    { method: "POST", pattern: "/archive-disposal/catalogs/:catalogId/items", module: "archive-disposal", eventType: "create", summary: "Thêm hồ sơ vào danh mục hủy" }, // [MỚI]
    { method: "PATCH", pattern: "/archive-disposal/catalogs/:catalogId/items/:itemId", module: "archive-disposal", eventType: "edit", summary: "Cập nhật lý do hủy hồ sơ" }, // [MỚI]
    { method: "DELETE", pattern: "/archive-disposal/catalogs/:catalogId/items/:itemId", module: "archive-disposal", eventType: "delete", summary: "Xóa hồ sơ khỏi danh mục hủy" }, // [MỚI]
    { method: "POST", pattern: "/archive-disposal/catalogs/:catalogId/submit", module: "archive-disposal", eventType: "submit", summary: "Trình duyệt danh mục đề xuất hủy" }, // [MỚI]
    { method: "POST", pattern: "/archive-disposal/catalogs/:catalogId/execute-destroy", module: "archive-disposal", eventType: "execute", summary: "Thực hiện hủy danh mục" }, // [MỚI]
    { method: "POST", pattern: "/archive-disposal/transfer-to-proposal", module: "archive-disposal", eventType: "transfer", summary: "Chuyển hồ sơ sang đề xuất hủy" }, // [MỚI]
    { method: "GET", pattern: "/archive-disposal/settings", module: "archive-disposal", eventType: "view", summary: "Xem cấu hình quy trình xét hủy" }, // [MỚI]
    { method: "PATCH", pattern: "/archive-disposal/settings", module: "archive-disposal", eventType: "edit", summary: "Cập nhật cấu hình quy trình xét hủy" }, // [MỚI]
    { method: "GET", pattern: "/archive-disposal/councils", module: "archive-disposal", eventType: "view", summary: "Xem danh sách Hội đồng xét hủy" }, // [MỚI]
    { method: "POST", pattern: "/archive-disposal/councils", module: "archive-disposal", eventType: "create", summary: "Tạo Hội đồng xét hủy" }, // [MỚI]
    { method: "GET", pattern: "/archive-disposal/councils/:councilId", module: "archive-disposal", eventType: "view", summary: "Xem chi tiết Hội đồng xét hủy" }, // [MỚI]
    { method: "GET", pattern: "/archive-disposal/councils/:councilId/history", module: "archive-disposal", eventType: "view", summary: "Xem lịch sử thay đổi Hội đồng" }, // [MỚI]
    { method: "POST", pattern: "/archive-disposal/councils/:councilId/copy-members", module: "archive-disposal", eventType: "create", summary: "Sao chép thành viên Hội đồng" }, // [MỚI]
    { method: "PATCH", pattern: "/archive-disposal/councils/:councilId/members", module: "archive-disposal", eventType: "edit", summary: "Cập nhật thành viên Hội đồng" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: ARCHIVE BORROW REQUESTS
    // ═══════════════════════════════════════════════════════════
    { method: "POST", pattern: "/archive-borrow-requests", module: "archive-borrow", eventType: "create", summary: "Tạo yêu cầu mượn tài liệu" }, // [MỚI]
    { method: "GET", pattern: "/archive-borrow-requests/mine", module: "archive-borrow", eventType: "view", summary: "Xem yêu cầu mượn của tôi" }, // [MỚI]
    { method: "GET", pattern: "/archive-borrow-requests/mine/reading-summary", module: "archive-borrow", eventType: "view", summary: "Xem tóm tắt đang đọc" }, // [MỚI]
    { method: "GET", pattern: "/archive-borrow-requests/pending", module: "archive-borrow", eventType: "view", summary: "Xem yêu cầu mượn chờ duyệt" }, // [MỚI]
    { method: "GET", pattern: "/archive-borrow-requests/search-dossiers", module: "archive-borrow", eventType: "view", summary: "Tìm hồ sơ để đăng ký mượn" }, // [MỚI]
    { method: "GET", pattern: "/archive-borrow-requests/:id", module: "archive-borrow", eventType: "view", summary: "Xem chi tiết yêu cầu mượn" }, // [MỚI]
    { method: "POST", pattern: "/archive-borrow-requests/:id/approve", module: "archive-borrow", eventType: "approve", summary: "Duyệt yêu cầu mượn tài liệu" }, // [MỚI]
    { method: "POST", pattern: "/archive-borrow-requests/:id/reject", module: "archive-borrow", eventType: "reject", summary: "Từ chối yêu cầu mượn tài liệu" }, // [MỚI]
    { method: "POST", pattern: "/archive-borrow-requests/:id/regenerate-dip", module: "archive-borrow", eventType: "create", summary: "Tạo lại gói DIP cho mượn" }, // [MỚI]
    { method: "POST", pattern: "/archive-borrow-requests/:id/activate", module: "archive-borrow", eventType: "activate", summary: "Kích hoạt liên kết xem trực tuyến" }, // [MỚI]
    { method: "GET", pattern: "/archive-borrow-requests/:id/view-model", module: "archive-borrow", eventType: "view", summary: "Xem nội dung mượn trực tuyến" }, // [MỚI]
    { method: "GET", pattern: "/archive-borrow-requests/:id/dossiers/:dossierId/metadata", module: "archive-borrow", eventType: "view", summary: "Xem metadata hồ sơ mượn" }, // [MỚI]
    { method: "GET", pattern: "/archive-borrow-requests/:id/dip/files/:fileId/content", module: "archive-borrow", eventType: "view", summary: "Xem file PDF mượn trực tuyến" }, // [MỚI]
    { method: "GET", pattern: "/archive-borrow-requests/:id/reading-progress", module: "archive-borrow", eventType: "view", summary: "Xem tiến độ đọc" }, // [MỚI]
    { method: "PUT", pattern: "/archive-borrow-requests/:id/reading-progress", module: "archive-borrow", eventType: "edit", summary: "Lưu tiến độ đọc" }, // [MỚI]
    { method: "GET", pattern: "/archive-borrow-requests/:id/annotations", module: "archive-borrow", eventType: "view", summary: "Xem ghi chú cá nhân" }, // [MỚI]
    { method: "POST", pattern: "/archive-borrow-requests/:id/annotations", module: "archive-borrow", eventType: "create", summary: "Tạo ghi chú cá nhân" }, // [MỚI]
    { method: "PATCH", pattern: "/archive-borrow-requests/:id/annotations/:annotationId", module: "archive-borrow", eventType: "edit", summary: "Cập nhật ghi chú cá nhân" }, // [MỚI]
    { method: "DELETE", pattern: "/archive-borrow-requests/:id/annotations/:annotationId", module: "archive-borrow", eventType: "delete", summary: "Xóa ghi chú cá nhân" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: SEARCH (Tìm kiếm toàn văn)
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/search", module: "search", eventType: "view", summary: "Tìm kiếm toàn văn trong kho dữ liệu" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: SECURITY LEVELS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/security-levels", module: "security-levels", eventType: "view", summary: "Xem danh sách cấp độ bảo mật" }, // [CŨ]
    { method: "GET", pattern: "/security-levels/:id", module: "security-levels", eventType: "view", summary: "Xem chi tiết cấp độ bảo mật" }, // [CŨ]
    { method: "POST", pattern: "/security-levels", module: "security-levels", eventType: "create", summary: "Tạo cấp độ bảo mật mới" }, // [MỚI]
    { method: "GET", pattern: "/security-levels/active", module: "security-levels", eventType: "view", summary: "Xem cấp bảo mật đang hoạt động" }, // [MỚI]
    { method: "POST", pattern: "/security-levels/verify-access", module: "security-levels", eventType: "verify", summary: "Xác thực mật khẩu cấp bảo mật" }, // [MỚI]
    { method: "POST", pattern: "/security-levels/verify-file-access", module: "security-levels", eventType: "verify", summary: "Xác thực mật khẩu file" }, // [MỚI]
    { method: "PUT", pattern: "/security-levels/:id", module: "security-levels", eventType: "edit", summary: "Cập nhật cấp độ bảo mật" }, // [MỚI]
    { method: "DELETE", pattern: "/security-levels/:id", module: "security-levels", eventType: "delete", summary: "Xóa cấp độ bảo mật" }, // [MỚI]
    { method: "GET", pattern: "/security-levels/:id/rules", module: "security-levels", eventType: "view", summary: "Xem quy tắc bảo mật theo cấp" }, // [MỚI]
    { method: "PATCH", pattern: "/security-levels/:id/rules", module: "security-levels", eventType: "edit", summary: "Cập nhật quy tắc/mật khẩu bảo mật" }, // [MỚI]
  
    // ═══════════════════════════════════════════════════════════
    // MODULE: SECURITY PERMISSION DEFS
    // ═══════════════════════════════════════════════════════════
    { method: "GET", pattern: "/security-permission-defs", module: "security-levels", eventType: "view", summary: "Xem định nghĩa quyền bảo mật" }, // [CŨ]
    { method: "POST", pattern: "/security-permission-defs", module: "security-permission-defs", eventType: "create", summary: "Tạo định nghĩa quyền bảo mật" }, // [MỚI]
    { method: "GET", pattern: "/security-permission-defs/active", module: "security-permission-defs", eventType: "view", summary: "Xem quyền bảo mật đang hoạt động" }, // [MỚI]
    { method: "PUT", pattern: "/security-permission-defs/:id", module: "security-permission-defs", eventType: "edit", summary: "Cập nhật định nghĩa quyền bảo mật" }, // [MỚI]
    { method: "DELETE", pattern: "/security-permission-defs/:id", module: "security-permission-defs", eventType: "delete", summary: "Xóa định nghĩa quyền bảo mật" }, // [MỚI]
  ];;

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
