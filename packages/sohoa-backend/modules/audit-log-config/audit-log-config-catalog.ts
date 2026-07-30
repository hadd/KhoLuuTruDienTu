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

    { module: "security-levels", moduleLabel: "Cấp độ bảo mật", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: true },
    { module: "security-levels", moduleLabel: "Cấp độ bảo mật", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "security-levels", moduleLabel: "Cấp độ bảo mật", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "security-levels", moduleLabel: "Cấp độ bảo mật", actionKey: "delete", label: "Xóa", defaultEnabled: true },
    { module: "security-levels", moduleLabel: "Cấp độ bảo mật", actionKey: "verify", label: "Xác minh mật khẩu cấp độ", defaultEnabled: true },

    { module: "notifications", moduleLabel: "Thông báo", actionKey: "view", label: "Xem hộp thư", defaultEnabled: true },
    { module: "notifications", moduleLabel: "Thông báo", actionKey: "update", label: "Đánh dấu đã đọc", defaultEnabled: true },

    { module: "audit-log", moduleLabel: "Nhật ký hệ thống", actionKey: "view", label: "Xem nhật ký", defaultEnabled: true },
    { module: "audit-log", moduleLabel: "Nhật ký hệ thống", actionKey: "delete", label: "Xóa nhật ký", defaultEnabled: true },

    { module: "audit-log-config", moduleLabel: "Cấu hình nhật ký", actionKey: "view", label: "Xem cấu hình", defaultEnabled: true },
    { module: "audit-log-config", moduleLabel: "Cấu hình nhật ký", actionKey: "update", label: "Cập nhật cấu hình", defaultEnabled: true },
];

export function catalogKey(module: string, actionKey: string): string {
    return `${module}:${actionKey}`;
}

export function getCatalogDefault(module: string, actionKey: string): boolean {
    const entry = AUDIT_LOG_CONFIG_CATALOG.find(
        (item) => item.module === module && item.actionKey === actionKey,
    );
    if (entry) return entry.defaultEnabled;
    // Read/list traffic is noisy; only log when explicitly catalogued & enabled.
    //if (actionKey === "view" || actionKey === "list") return false;
    return true;
}
