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

    { module: "fonds", moduleLabel: "Phông lưu trữ", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: false },
    { module: "fonds", moduleLabel: "Phông lưu trữ", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "fonds", moduleLabel: "Phông lưu trữ", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "fonds", moduleLabel: "Phông lưu trữ", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "retention-periods", moduleLabel: "Thời hạn lưu trữ", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: false },
    { module: "retention-periods", moduleLabel: "Thời hạn lưu trữ", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "retention-periods", moduleLabel: "Thời hạn lưu trữ", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "retention-periods", moduleLabel: "Thời hạn lưu trữ", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "view", label: "Xem / tìm kiếm", defaultEnabled: false },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "delete", label: "Xóa", defaultEnabled: true },
    { module: "archive", moduleLabel: "Kho lưu trữ", actionKey: "print", label: "In / xuất", defaultEnabled: true },

    { module: "data-entry", moduleLabel: "Biên tập / duyệt", actionKey: "edit", label: "Biên tập metadata", defaultEnabled: true },
    { module: "data-entry", moduleLabel: "Biên tập / duyệt", actionKey: "approve", label: "Duyệt hồ sơ", defaultEnabled: true },
    { module: "data-entry", moduleLabel: "Biên tập / duyệt", actionKey: "reject", label: "Từ chối hồ sơ", defaultEnabled: true },

    { module: "users", moduleLabel: "Người dùng", actionKey: "view", label: "Xem danh sách / chi tiết", defaultEnabled: false },
    { module: "users", moduleLabel: "Người dùng", actionKey: "create", label: "Tạo mới", defaultEnabled: true },
    { module: "users", moduleLabel: "Người dùng", actionKey: "update", label: "Cập nhật", defaultEnabled: true },
    { module: "users", moduleLabel: "Người dùng", actionKey: "delete", label: "Xóa", defaultEnabled: true },

    { module: "roles", moduleLabel: "Phân quyền", actionKey: "view", label: "Xem vai trò", defaultEnabled: false },
    { module: "roles", moduleLabel: "Phân quyền", actionKey: "create", label: "Tạo vai trò", defaultEnabled: true },
    { module: "roles", moduleLabel: "Phân quyền", actionKey: "update", label: "Cập nhật vai trò", defaultEnabled: true },
    { module: "roles", moduleLabel: "Phân quyền", actionKey: "delete", label: "Xóa vai trò", defaultEnabled: true },
    { module: "roles", moduleLabel: "Phân quyền", actionKey: "permission_change", label: "Thay đổi quyền", defaultEnabled: true },

    { module: "watermark", moduleLabel: "Watermark", actionKey: "view", label: "Xem cấu hình", defaultEnabled: false },
    { module: "watermark", moduleLabel: "Watermark", actionKey: "create", label: "Tạo cấu hình", defaultEnabled: true },
    { module: "watermark", moduleLabel: "Watermark", actionKey: "update", label: "Cập nhật cấu hình", defaultEnabled: true },
    { module: "watermark", moduleLabel: "Watermark", actionKey: "delete", label: "Xóa cấu hình", defaultEnabled: true },

    { module: "metadata", moduleLabel: "Cấu hình metadata", actionKey: "template_change", label: "Thay đổi mẫu metadata", defaultEnabled: true },
    { module: "metadata", moduleLabel: "Cấu hình metadata", actionKey: "permission_change", label: "Thay đổi phân quyền metadata", defaultEnabled: true },
    { module: "metadata", moduleLabel: "Cấu hình metadata", actionKey: "naming_change", label: "Thay đổi quy tắc đặt tên", defaultEnabled: true },
    { module: "metadata", moduleLabel: "Cấu hình metadata", actionKey: "export_preset_change", label: "Thay đổi preset xuất", defaultEnabled: true },
];

export function catalogKey(module: string, actionKey: string): string {
    return `${module}:${actionKey}`;
}

export function getCatalogDefault(module: string, actionKey: string): boolean {
    const entry = AUDIT_LOG_CONFIG_CATALOG.find(
        (item) => item.module === module && item.actionKey === actionKey,
    );
    return entry?.defaultEnabled ?? true;
}
