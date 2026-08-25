import { Permission } from "../auth/permission-catalog.ts";

export type AuditLogCatalogEntry = {
    module: string;
    moduleLabel: string;
    actionKey: string;
    label: string;
    defaultEnabled: boolean;
};

export const AUDIT_LOG_CONFIG_CATALOG: AuditLogCatalogEntry[] = [
    { module: "auth", moduleLabel: "Xác thực", actionKey: "login", label: "Đăng nhập thành công", defaultEnabled: true },
    { module: "auth", moduleLabel: "Xác thực", actionKey: "login_failed", label: "Đăng nhập thất bại", defaultEnabled: true },
    { module: "auth", moduleLabel: "Xác thực", actionKey: "logout", label: "Đăng xuất", defaultEnabled: true },

    { module: "fonds", moduleLabel: "Phông lưu trữ", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "fonds", moduleLabel: "Phông lưu trữ", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "fonds", moduleLabel: "Phông lưu trữ", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "fonds", moduleLabel: "Phông lưu trữ", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "retention-periods", moduleLabel: "Thời hạn lưu trữ", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "retention-periods", moduleLabel: "Thời hạn lưu trữ", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "retention-periods", moduleLabel: "Thời hạn lưu trữ", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "retention-periods", moduleLabel: "Thời hạn lưu trữ", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "view", label: "Xem / tìm kiếm", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "create", label: "Tạo hồ sơ", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "delete", label: "Xóa", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "print", label: "In / xuất", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "submit_archive", label: "Nộp lưu kho", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "approve_archive", label: "Duyệt lưu kho", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "reject_archive", label: "Từ chối lưu kho", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "move_file", label: "Chuyển file giữa hồ sơ", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "delete_file", label: "Xóa file trong kho", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "update_file", label: "Cập nhật file trong kho", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "place_physical", label: "Gắn hồ sơ vào kho vật lý", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "move_physical", label: "Đổi vị trí kho vật lý", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "remove_physical", label: "Gỡ hồ sơ khỏi kho vật lý", defaultEnabled: true },

    { module: "physical-warehouse", moduleLabel: "Kho vật lý", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "physical-warehouse", moduleLabel: "Kho vật lý", actionKey: "create", label: "Thêm mục kho", defaultEnabled: true },
    { module: "physical-warehouse", moduleLabel: "Kho vật lý", actionKey: "update", label: "Cập nhật mục kho", defaultEnabled: true },
    { module: "physical-warehouse", moduleLabel: "Kho vật lý", actionKey: "delete", label: "Xóa mục kho", defaultEnabled: true },
    { module: "physical-warehouse", moduleLabel: "Kho vật lý", actionKey: "reparent", label: "Di chuyển ô chứa trong sơ đồ kho", defaultEnabled: true },

    { module: "inventories", moduleLabel: "Mục lục", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "inventories", moduleLabel: "Mục lục", actionKey: "create", label: "Tạo mục lục", defaultEnabled: true },
    { module: "inventories", moduleLabel: "Mục lục", actionKey: "update", label: "Cập nhật mục lục", defaultEnabled: true },
    { module: "inventories", moduleLabel: "Mục lục", actionKey: "delete", label: "Xóa mục lục", defaultEnabled: true },

    { module: "data-entry", moduleLabel: "Biên tập / duyệt", actionKey: "view", label: "Xem / nhận hồ sơ biên tập", defaultEnabled: true },
    { module: "data-entry", moduleLabel: "Biên tập / duyệt", actionKey: "edit", label: "Biên tập metadata", defaultEnabled: true },
    { module: "data-entry", moduleLabel: "Biên tập / duyệt", actionKey: "approve", label: "Duyệt hồ sơ", defaultEnabled: true },
    { module: "data-entry", moduleLabel: "Biên tập / duyệt", actionKey: "reject", label: "Từ chối hồ sơ", defaultEnabled: true },

    { module: "users", moduleLabel: "Người dùng", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "users", moduleLabel: "Người dùng", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "users", moduleLabel: "Người dùng", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "users", moduleLabel: "Người dùng", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "roles", moduleLabel: "Phân quyền", actionKey: "view", label: "Xem vai trò", defaultEnabled: true },
    { module: "roles", moduleLabel: "Phân quyền", actionKey: "create", label: "Tạo vai trò", defaultEnabled: true },
    { module: "roles", moduleLabel: "Phân quyền", actionKey: "update", label: "Cập nhật vai trò", defaultEnabled: true },
    { module: "roles", moduleLabel: "Phân quyền", actionKey: "delete", label: "Xóa vai trò", defaultEnabled: true },
    { module: "roles", moduleLabel: "Phân quyền", actionKey: "permission_change", label: "Thay đổi quyền", defaultEnabled: true },

    { module: "watermark", moduleLabel: "Watermark", actionKey: "view", label: "Xem cấu hình", defaultEnabled: true },
    { module: "watermark", moduleLabel: "Watermark", actionKey: "create", label: "Tạo cấu hình", defaultEnabled: true },
    { module: "watermark", moduleLabel: "Watermark", actionKey: "update", label: "Cập nhật cấu hình", defaultEnabled: true },
    { module: "watermark", moduleLabel: "Watermark", actionKey: "delete", label: "Xóa cấu hình", defaultEnabled: true },

    { module: "metadata", moduleLabel: "Cấu hình metadata", actionKey: "template_change", label: "Thay đổi mẫu metadata", defaultEnabled: true },
    { module: "metadata", moduleLabel: "Cấu hình metadata", actionKey: "permission_change", label: "Thay đổi phân quyền metadata", defaultEnabled: true },
    { module: "metadata", moduleLabel: "Cấu hình metadata", actionKey: "naming_change", label: "Thay đổi quy tắc đặt tên", defaultEnabled: true },
    { module: "metadata", moduleLabel: "Cấu hình metadata", actionKey: "export_preset_change", label: "Thay đổi preset xuất", defaultEnabled: true },

    { module: "folders", moduleLabel: "Thư mục", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "folders", moduleLabel: "Thư mục", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "folders", moduleLabel: "Thư mục", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "folders", moduleLabel: "Thư mục", actionKey: "delete", label: "Xóa", defaultEnabled: true },
    { module: "folders", moduleLabel: "Thư mục", actionKey: "assign", label: "Gán dự án / phân công", defaultEnabled: true },
    { module: "folders", moduleLabel: "Thư mục", actionKey: "export", label: "Xuất metadata / file", defaultEnabled: true },

    { module: "scan-intake", moduleLabel: "Scan intake", actionKey: "view", label: "Xem phiên scan", defaultEnabled: true },
    { module: "scan-intake", moduleLabel: "Scan intake", actionKey: "create", label: "Tạo / upload", defaultEnabled: true },
    { module: "scan-intake", moduleLabel: "Scan intake", actionKey: "update", label: "Cập nhật / sắp xếp", defaultEnabled: true },
    { module: "scan-intake", moduleLabel: "Scan intake", actionKey: "delete", label: "Xóa trang / tài liệu / phiên", defaultEnabled: true },
    { module: "scan-intake", moduleLabel: "Scan intake", actionKey: "promote", label: "Đẩy lên hồ sơ", defaultEnabled: true },

    { module: "digital-sign", moduleLabel: "Ký số", actionKey: "view", label: "Xem trạng thái / lịch sử", defaultEnabled: true },
    { module: "digital-sign", moduleLabel: "Ký số", actionKey: "prepare", label: "Chuẩn bị ký", defaultEnabled: true },
    { module: "digital-sign", moduleLabel: "Ký số", actionKey: "submit", label: "Gửi ký", defaultEnabled: true },
    { module: "digital-sign", moduleLabel: "Ký số", actionKey: "verify", label: "Xác minh chữ ký", defaultEnabled: true },

    { module: "dossier-types", moduleLabel: "Loại hồ sơ", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "dossier-types", moduleLabel: "Loại hồ sơ", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "dossier-types", moduleLabel: "Loại hồ sơ", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "dossier-types", moduleLabel: "Loại hồ sơ", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "document-types", moduleLabel: "Loại tài liệu", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "document-types", moduleLabel: "Loại tài liệu", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "document-types", moduleLabel: "Loại tài liệu", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "document-types", moduleLabel: "Loại tài liệu", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "issue-reports", moduleLabel: "Thông báo vấn đề", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "issue-reports", moduleLabel: "Thông báo vấn đề", actionKey: "confirm", label: "Xác nhận", defaultEnabled: true },
    { module: "issue-reports", moduleLabel: "Thông báo vấn đề", actionKey: "reject", label: "Từ chối", defaultEnabled: true },
    { module: "issue-reports", moduleLabel: "Thông báo vấn đề", actionKey: "escalate", label: "Chuyển tiếp", defaultEnabled: true },

    { module: "groups", moduleLabel: "Nhóm", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "groups", moduleLabel: "Nhóm", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "groups", moduleLabel: "Nhóm", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "groups", moduleLabel: "Nhóm", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "projects", moduleLabel: "Dự án", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "projects", moduleLabel: "Dự án", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "projects", moduleLabel: "Dự án", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "projects", moduleLabel: "Dự án", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "project-plans", moduleLabel: "Kế hoạch dự án", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "project-plans", moduleLabel: "Kế hoạch dự án", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "project-plans", moduleLabel: "Kế hoạch dự án", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "project-plans", moduleLabel: "Kế hoạch dự án", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "archive-disposal", moduleLabel: "Xét hủy hồ sơ", actionKey: "view", label: "Xem danh sách đề xuất / xét hủy", defaultEnabled: true },
    { module: "archive-disposal", moduleLabel: "Xét hủy hồ sơ", actionKey: "create", label: "Tạo đề xuất hủy", defaultEnabled: true },
    { module: "archive-disposal", moduleLabel: "Xét hủy hồ sơ", actionKey: "update", label: "Cập nhật đề xuất hủy", defaultEnabled: true },
    { module: "archive-disposal", moduleLabel: "Xét hủy hồ sơ", actionKey: "submit", label: "Trình duyệt đề xuất hủy", defaultEnabled: true },
    { module: "archive-disposal", moduleLabel: "Xét hủy hồ sơ", actionKey: "council_create", label: "Tạo / thành lập Hội đồng xét hủy", defaultEnabled: true },
    { module: "archive-disposal", moduleLabel: "Xét hủy hồ sơ", actionKey: "council_finalize", label: "Phê duyệt kết quả Hội đồng xét hủy", defaultEnabled: true },
    { module: "archive-disposal", moduleLabel: "Xét hủy hồ sơ", actionKey: "council_publish", label: "Xuất bản Quyết định Hội đồng", defaultEnabled: true },
    { module: "archive-disposal", moduleLabel: "Xét hủy hồ sơ", actionKey: "destroy", label: "Thực hiện hủy hồ sơ", defaultEnabled: true },

    { module: "security-levels", moduleLabel: "Cấp độ bảo mật", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "security-levels", moduleLabel: "Cấp độ bảo mật", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "security-levels", moduleLabel: "Cấp độ bảo mật", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "security-levels", moduleLabel: "Cấp độ bảo mật", actionKey: "delete", label: "Xóa", defaultEnabled: true },
    { module: "security-levels", moduleLabel: "Cấp độ bảo mật", actionKey: "verify", label: "Xác minh mật khẩu cấp độ", defaultEnabled: true },

    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "request_borrow", label: "Tạo phiếu mượn", defaultEnabled: true },
    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "approve_borrow", label: "Duyệt phiếu mượn", defaultEnabled: true },
    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "reject_borrow", label: "Từ chối phiếu mượn", defaultEnabled: true },
    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "regenerate_borrow_dip", label: "Tạo lại gói DIP", defaultEnabled: true },
    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "activate_borrow", label: "Kích hoạt xem trực tuyến", defaultEnabled: true },
    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "view_borrow_document", label: "Xem file DIP", defaultEnabled: true },
    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "expire_borrow", label: "Hết hạn phiếu mượn", defaultEnabled: true },
    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "edit", label: "Cập nhật tiến độ / ghi chú", defaultEnabled: true },
    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "create", label: "Tạo ghi chú", defaultEnabled: true },
    { module: "archive-borrow", moduleLabel: "Mượn tài liệu", actionKey: "delete", label: "Xóa ghi chú", defaultEnabled: true },

    { module: "notifications", moduleLabel: "Thông báo", actionKey: "view", label: "Xem hộp thư", defaultEnabled: true },
    { module: "notifications", moduleLabel: "Thông báo", actionKey: "update", label: "Đánh dấu đã đọc", defaultEnabled: true },

    { module: "dashboard", moduleLabel: "Dashboard thống kê", actionKey: "view", label: "Xem dashboard thống kê", defaultEnabled: true },

    { module: "audit-log", moduleLabel: "Lịch sử thao tác hệ thống", actionKey: "view", label: "Xem lịch sử thao tác hệ thống", defaultEnabled: true },
    { module: "audit-log", moduleLabel: "Lịch sử thao tác hệ thống", actionKey: "delete", label: "Xóa lịch sử thao tác hệ thống", defaultEnabled: true },

    { module: "audit-log-config", moduleLabel: "Cấu hình lịch sử thao tác hệ thống", actionKey: "view", label: "Xem cấu hình", defaultEnabled: true },
    { module: "audit-log-config", moduleLabel: "Cấu hình lịch sử thao tác hệ thống", actionKey: "update", label: "Cập nhật cấu hình", defaultEnabled: true },
];

/** Mapping of module key -> required permissions array. If null, NO permission required (e.g. auth). */
export const AUDIT_LOG_MODULE_PERMISSIONS: Record<string, readonly string[] | null> = {
    auth: null, // "auth" module requires NO permissions as requested ("Riêng quyền xác thực thì không cần quyền")
    fonds: [Permission.FONDS_READ, Permission.FONDS_CREATE, Permission.FONDS_UPDATE, Permission.FONDS_DELETE],
    "retention-periods": [Permission.RETENTION_PERIODS_READ, Permission.RETENTION_PERIODS_CREATE, Permission.RETENTION_PERIODS_UPDATE, Permission.RETENTION_PERIODS_DELETE],
    archive: [
        Permission.ARCHIVE_WAREHOUSE_READ,
        Permission.ARCHIVE_WAREHOUSE_EDIT,
        Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
        Permission.ARCHIVE_WAREHOUSE_DELETE,
        Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
        Permission.ARCHIVE_WAREHOUSE_DOWNLOAD,
        Permission.ARCHIVE_PERMISSIONS_MANAGE,
        Permission.DOSSIERS_READ,
        Permission.DOSSIERS_WRITE,
        Permission.ARCHIVE_SUBMIT,
        Permission.ARCHIVE_REVIEW,
        Permission.ARCHIVE_CONFIG_MANAGE,
    ],
    "physical-warehouse": [
        Permission.PHYSICAL_WAREHOUSE_ITEM_READ,
        Permission.PHYSICAL_WAREHOUSE_LOCATION_MANAGE,
        Permission.PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE,
    ],
    inventories: [Permission.INVENTORIES_READ, Permission.INVENTORIES_CREATE, Permission.INVENTORIES_UPDATE, Permission.INVENTORIES_DELETE],
    "data-entry": [Permission.DATA_ENTRY_MAKER, Permission.DATA_ENTRY_CHECKER],
    users: [Permission.USERS_READ, Permission.USERS_CREATE, Permission.USERS_UPDATE, Permission.USERS_DELETE, Permission.USERS_IMPORT, Permission.USERS_EXPORT],
    roles: [Permission.ROLES_MANAGE],
    watermark: [Permission.WATERMARK_CONFIG_READ, Permission.WATERMARK_CONFIG_CREATE, Permission.WATERMARK_CONFIG_UPDATE, Permission.WATERMARK_CONFIG_DELETE],
    metadata: [
        Permission.METADATA_TEMPLATES_MANAGE,
        Permission.METADATA_PERMISSIONS_MANAGE,
        Permission.METADATA_EXPORT_PRESETS_MANAGE,
        Permission.METADATA_NAMING_MANAGE,
        Permission.METADATA_EXTRACT_SETTINGS_READ,
        Permission.METADATA_EXTRACT_SETTINGS_UPDATE,
        Permission.METADATA_EXTRACT_TRIGGER,
    ],
    folders: [Permission.FOLDERS_BROWSE_ALL, Permission.FOLDERS_BROWSE_ASSIGNED],
    "scan-intake": [Permission.SCAN_INTAKE_USE],
    "digital-sign": [Permission.DOSSIERS_SIGN, Permission.DOSSIERS_READ],
    "dossier-types": [Permission.DOSSIER_TYPES_READ, Permission.DOSSIER_TYPES_CREATE, Permission.DOSSIER_TYPES_UPDATE, Permission.DOSSIER_TYPES_DELETE],
    "document-types": [Permission.DOCUMENT_TYPES_READ, Permission.DOCUMENT_TYPES_CREATE, Permission.DOCUMENT_TYPES_UPDATE, Permission.DOCUMENT_TYPES_DELETE],
    "issue-reports": [Permission.DOSSIERS_READ, Permission.DATA_ENTRY_MAKER, Permission.DATA_ENTRY_CHECKER],
    groups: [
        Permission.GROUPS_READ,
        Permission.GROUPS_READ_ALL,
        Permission.GROUPS_CREATE,
        Permission.GROUPS_UPDATE,
        Permission.GROUPS_DELETE,
        Permission.GROUPS_MANAGE_MEMBERS,
        Permission.GROUPS_START_WORKFLOW,
    ],
    projects: [Permission.PROJECTS_READ, Permission.PROJECTS_CREATE, Permission.PROJECTS_UPDATE, Permission.PROJECTS_DELETE],
    "project-plans": [Permission.PROJECT_PLANS_READ, Permission.PROJECT_PLANS_CREATE, Permission.PROJECT_PLANS_UPDATE, Permission.PROJECT_PLANS_DELETE],
    "archive-disposal": [
        Permission.ARCHIVE_DISPOSAL_READ,
        Permission.ARCHIVE_DISPOSAL_CREATE,
        Permission.ARCHIVE_DISPOSAL_UPDATE,
        Permission.ARCHIVE_DISPOSAL_SUBMIT,
        Permission.ARCHIVE_DISPOSAL_COUNCIL_READ,
        Permission.ARCHIVE_DISPOSAL_COUNCIL_CREATE,
        Permission.ARCHIVE_DISPOSAL_COUNCIL_UPDATE,
        Permission.ARCHIVE_DISPOSAL_COUNCIL_FINALIZE,
        Permission.ARCHIVE_DISPOSAL_COUNCIL_PUBLISH,
        Permission.ARCHIVE_DISPOSAL_COUNCIL_CHAIR_DECIDE,
        Permission.ARCHIVE_DISPOSAL_SETTINGS_MANAGE,
        Permission.ARCHIVE_DISPOSAL_DESTROY,
    ],
    "security-levels": [
        Permission.SECURITY_LEVELS_READ,
        Permission.SECURITY_LEVELS_CREATE,
        Permission.SECURITY_LEVELS_UPDATE,
        Permission.SECURITY_LEVELS_DELETE,
        Permission.SECURITY_LEVELS_CONFIG,
        Permission.SECURITY_LEVELS_PERMISSION_DEFS_READ,
        Permission.SECURITY_LEVELS_PERMISSION_DEFS_MANAGE,
    ],
    "archive-borrow": [
        Permission.ARCHIVE_BORROW_REQUEST,
        Permission.ARCHIVE_BORROW_REVIEW,
        Permission.LIBRARY_BORROW_APPROVAL_CONFIG_MANAGE,
        Permission.LIBRARY_EXPLOITATION_READ,
    ],
    notifications: [Permission.NOTIFICATIONS_CONFIG_MANAGE],
    dashboard: [Permission.DASHBOARD_EDITOR, Permission.DASHBOARD_QC, Permission.DASHBOARD_ADMIN, Permission.DASHBOARD_WAREHOUSE],
    "audit-log": [Permission.AUDIT_LOGS_READ, Permission.AUDIT_LOGS_DELETE, Permission.AUDIT_LOGS_EXPORT],
    "audit-log-config": [Permission.AUDIT_LOGS_CONFIG],
};

export function catalogKey(module: string, actionKey: string): string {
    return `${module}:${actionKey}`;
}

export function getCatalogDefault(module: string, actionKey: string): boolean {
    const entry = AUDIT_LOG_CONFIG_CATALOG.find(
        (item) => item.module === module && item.actionKey === actionKey,
    );
    if (entry) return entry.defaultEnabled;
    return true;
}

