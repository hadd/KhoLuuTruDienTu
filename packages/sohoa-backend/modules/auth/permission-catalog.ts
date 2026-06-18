export const Permission = {
    USERS_READ: "users.read",
    USERS_CREATE: "users.create",
    USERS_UPDATE: "users.update",
    USERS_DELETE: "users.delete",
    USERS_IMPORT: "users.import",
    USERS_EXPORT: "users.export",
    USERS_RESET_PASSWORD: "users.reset_password",

    ROLES_READ: "roles.read",
    ROLES_MANAGE: "roles.manage",

    GROUPS_READ: "groups.read",
    GROUPS_CREATE: "groups.create",
    GROUPS_UPDATE: "groups.update",
    GROUPS_DELETE: "groups.delete",
    GROUPS_MANAGE_MEMBERS: "groups.manage_members",
    GROUPS_START_WORKFLOW: "groups.start_workflow",

    FOLDERS_READ: "folders.read",
    FOLDERS_WRITE: "folders.write",
    FOLDERS_TREE: "folders.tree",

    DOSSIERS_READ: "dossiers.read",
    DOSSIERS_WRITE: "dossiers.write",
    DOSSIERS_ASSIGN: "dossiers.assign",
    DOSSIERS_EXPORT: "dossiers.export",

    PROJECTS_READ: "projects.read",
    PROJECTS_CREATE: "projects.create",
    PROJECTS_UPDATE: "projects.update",
    PROJECTS_DELETE: "projects.delete",

    AUDIT_LOGS_READ: "audit_logs.read",

    DATA_ENTRY_MAKER: "data-entry.maker",
    DATA_ENTRY_CHECKER: "data-entry.checker",
} as const;

export type PermissionKey = typeof Permission[keyof typeof Permission];

export interface PermissionDefinition {
    key: PermissionKey | "*";
    module: string;
    label: string;
    description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
    { key: Permission.USERS_READ, module: "users", label: "Xem người dùng", description: "Xem danh sách và chi tiết người dùng" },
    { key: Permission.USERS_CREATE, module: "users", label: "Tạo người dùng", description: "Tạo tài khoản người dùng mới" },
    { key: Permission.USERS_UPDATE, module: "users", label: "Sửa người dùng", description: "Cập nhật thông tin người dùng" },
    { key: Permission.USERS_DELETE, module: "users", label: "Xóa người dùng", description: "Xóa hoặc vô hiệu hóa người dùng" },
    { key: Permission.USERS_IMPORT, module: "users", label: "Import người dùng", description: "Import người dùng từ Excel" },
    { key: Permission.USERS_EXPORT, module: "users", label: "Export người dùng", description: "Export danh sách người dùng" },
    { key: Permission.USERS_RESET_PASSWORD, module: "users", label: "Reset mật khẩu", description: "Đặt lại mật khẩu người dùng" },

    { key: Permission.ROLES_READ, module: "roles", label: "Xem vai trò", description: "Xem danh sách vai trò và quyền" },
    { key: Permission.ROLES_MANAGE, module: "roles", label: "Quản lý vai trò", description: "Tạo, sửa, xóa vai trò và cấu hình quyền" },

    { key: Permission.GROUPS_READ, module: "groups", label: "Xem nhóm", description: "Xem nhóm (phạm vi theo membership nếu không có quyền quản trị)" },
    { key: Permission.GROUPS_CREATE, module: "groups", label: "Tạo nhóm", description: "Tạo nhóm mới" },
    { key: Permission.GROUPS_UPDATE, module: "groups", label: "Sửa nhóm", description: "Cập nhật thông tin nhóm" },
    { key: Permission.GROUPS_DELETE, module: "groups", label: "Xóa nhóm", description: "Xóa nhóm" },
    { key: Permission.GROUPS_MANAGE_MEMBERS, module: "groups", label: "Quản lý thành viên", description: "Phân công thành viên nhóm" },
    { key: Permission.GROUPS_START_WORKFLOW, module: "groups", label: "Khởi chạy workflow", description: "Assign dossier và sync QC workflow" },

    { key: Permission.FOLDERS_READ, module: "folders", label: "Xem thư mục", description: "Xem cây thư mục và hồ sơ" },
    { key: Permission.FOLDERS_WRITE, module: "folders", label: "Sửa thư mục", description: "Tạo, sửa, xóa thư mục" },
    { key: Permission.FOLDERS_TREE, module: "folders", label: "Xem toàn bộ cây", description: "Xem full folder tree (admin)" },

    { key: Permission.DOSSIERS_READ, module: "dossiers", label: "Xem hồ sơ", description: "Xem danh sách và chi tiết hồ sơ" },
    { key: Permission.DOSSIERS_WRITE, module: "dossiers", label: "Sửa hồ sơ", description: "Tạo, sửa, xóa hồ sơ" },
    { key: Permission.DOSSIERS_ASSIGN, module: "dossiers", label: "Phân công hồ sơ", description: "Assign hồ sơ cho người dùng" },
    { key: Permission.DOSSIERS_EXPORT, module: "dossiers", label: "Export hồ sơ", description: "Export metadata hồ sơ" },

    { key: Permission.PROJECTS_READ, module: "projects", label: "Xem dự án", description: "Xem danh sách và chi tiết dự án" },
    { key: Permission.PROJECTS_CREATE, module: "projects", label: "Tạo dự án", description: "Tạo dự án mới" },
    { key: Permission.PROJECTS_UPDATE, module: "projects", label: "Sửa dự án", description: "Cập nhật thông tin dự án và gia hạn" },
    { key: Permission.PROJECTS_DELETE, module: "projects", label: "Xóa dự án", description: "Xóa dự án" },

    { key: Permission.AUDIT_LOGS_READ, module: "audit_logs", label: "Xem audit log", description: "Xem nhật ký hệ thống" },

    { key: Permission.DATA_ENTRY_MAKER, module: "data-entry", label: "Nhập liệu", description: "Claim và nhập liệu hồ sơ" },
    { key: Permission.DATA_ENTRY_CHECKER, module: "data-entry", label: "Kiểm tra QC", description: "Duyệt/từ chối hồ sơ QC" },
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key) as PermissionKey[];

const PERMISSION_KEY_SET = new Set<string>(ALL_PERMISSION_KEYS);

export function isKnownPermissionKey(key: string): boolean {
    return key === "*" || PERMISSION_KEY_SET.has(key);
}

export function isValidPermissionPattern(pattern: string): boolean {
    if (pattern === "*") return true;
    if (pattern.endsWith(".*")) {
        const prefix = pattern.slice(0, -2);
        return ALL_PERMISSION_KEYS.some((k) => k.startsWith(`${prefix}.`));
    }
    return isKnownPermissionKey(pattern);
}
