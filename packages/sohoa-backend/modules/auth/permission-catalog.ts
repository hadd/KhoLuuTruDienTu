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

    DOSSIERS_READ: "dossiers.read",
    DOSSIERS_WRITE: "dossiers.write",
    DOSSIERS_ASSIGN: "dossiers.assign",
    DOSSIERS_EXPORT: "dossiers.export",

    PROJECTS_READ: "projects.read",
    PROJECTS_CREATE: "projects.create",
    PROJECTS_UPDATE: "projects.update",
    PROJECTS_DELETE: "projects.delete",

    AUDIT_LOGS_READ: "audit_logs.read",

    DASHBOARD_EDITOR: "dashboard.editor",
    DASHBOARD_QC: "dashboard.qc",
    DASHBOARD_ADMIN: "dashboard.admin",

    DATA_ENTRY_MAKER: "data-entry.maker",
    DATA_ENTRY_CHECKER: "data-entry.checker",

    METADATA_TEMPLATES_MANAGE: "metadata.templates.manage",
    METADATA_PERMISSIONS_MANAGE: "metadata.permissions.manage",
} as const;

export type PermissionKey = typeof Permission[keyof typeof Permission];

export interface PermissionDefinition {
    key: PermissionKey | "*";
    module: string;
    label: string;
    description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
    {
        key: Permission.USERS_READ,
        module: "users",
        label: "Xem người dùng",
        description: "Xem danh sách và thông tin chi tiết tài khoản người dùng trong hệ thống",
    },
    {
        key: Permission.USERS_CREATE,
        module: "users",
        label: "Tạo người dùng",
        description: "Thêm tài khoản người dùng mới",
    },
    {
        key: Permission.USERS_UPDATE,
        module: "users",
        label: "Sửa người dùng",
        description: "Cập nhật họ tên, email, vai trò và thông tin tài khoản người dùng",
    },
    {
        key: Permission.USERS_DELETE,
        module: "users",
        label: "Xóa người dùng",
        description: "Vô hiệu hóa hoặc xóa tài khoản người dùng",
    },
    {
        key: Permission.USERS_IMPORT,
        module: "users",
        label: "Nhập người dùng",
        description: "Nhập danh sách người dùng từ file Excel",
    },
    {
        key: Permission.USERS_EXPORT,
        module: "users",
        label: "Xuất người dùng",
        description: "Xuất danh sách người dùng ra file Excel",
    },
    {
        key: Permission.USERS_RESET_PASSWORD,
        module: "users",
        label: "Đặt lại mật khẩu",
        description: "Đặt lại mật khẩu cho tài khoản người dùng",
    },

    {
        key: Permission.ROLES_READ,
        module: "roles",
        label: "Xem vai trò",
        description: "Xem danh sách vai trò và các quyền được gán cho từng vai trò",
    },
    {
        key: Permission.ROLES_MANAGE,
        module: "roles",
        label: "Quản lý vai trò",
        description: "Tạo, sửa, xóa vai trò và cấu hình ma trận quyền truy cập",
    },

    {
        key: Permission.GROUPS_READ,
        module: "groups",
        label: "Xem nhóm",
        description: "Xem danh sách nhóm làm việc (chỉ nhóm mình tham gia nếu không có quyền quản trị nhóm)",
    },
    {
        key: Permission.GROUPS_CREATE,
        module: "groups",
        label: "Tạo nhóm",
        description: "Tạo nhóm làm việc mới ",
    },
    {
        key: Permission.GROUPS_UPDATE,
        module: "groups",
        label: "Sửa nhóm",
        description: "Cập nhật tên, mô tả, số vòng duyệt và cấu hình nhóm làm việc",
    },
    {
        key: Permission.GROUPS_DELETE,
        module: "groups",
        label: "Xóa nhóm",
        description: "Xóa nhóm làm việc khỏi hệ thống",
    },
    {
        key: Permission.GROUPS_MANAGE_MEMBERS,
        module: "groups",
        label: "Quản lý thành viên nhóm",
        description: "Thêm, bớt thành viên trong nhóm",
    },
    {
        key: Permission.GROUPS_START_WORKFLOW,
        module: "groups",
        label: "Phân công theo nhóm",
        description: "Phân công hồ sơ cho thành viên theo thư mục và đồng bộ luồng duyệt của nhóm",
    },

    {
        key: Permission.FOLDERS_READ,
        module: "folders",
        label: "Xem thư mục",
        description: "Xem cây thư mục và xem hồ sơ trong phạm vi được phép",
    },
    {
        key: Permission.FOLDERS_WRITE,
        module: "folders",
        label: "Quản lý thư mục",
        description: "Tạo, đổi tên và xóa thư mục",
    },

    {
        key: Permission.DOSSIERS_READ,
        module: "dossiers",
        label: "Xem hồ sơ",
        description: "Xem danh sách, chi tiết hồ sơ, lịch sử metadata và file đính kèm",
    },
    {
        key: Permission.DOSSIERS_WRITE,
        module: "dossiers",
        label: "Quản lý hồ sơ",
        description: "Tạo, sửa, xóa hồ sơ và upload tài liệu lên kho lưu trữ",
    },
    {
        key: Permission.DOSSIERS_ASSIGN,
        module: "dossiers",
        label: "Phân công hồ sơ",
        description: "Gán hồ sơ cho người duyệt hoặc biên tập",
    },
    {
        key: Permission.DOSSIERS_EXPORT,
        module: "dossiers",
        label: "Xuất hồ sơ",
        description: "Xuất metadata, gói DIP/AIP và file Excel theo hồ sơ hoặc bộ hồ sơ",
    },

    {
        key: Permission.PROJECTS_READ,
        module: "projects",
        label: "Xem dự án",
        description: "Xem danh sách và thông tin chi tiết dự án số hóa",
    },
    {
        key: Permission.PROJECTS_CREATE,
        module: "projects",
        label: "Tạo dự án",
        description: "Tạo dự án số hóa mới",
    },
    {
        key: Permission.PROJECTS_UPDATE,
        module: "projects",
        label: "Sửa dự án",
        description: "Cập nhật thông tin dự án, tiến độ và gia hạn thời gian thực hiện",
    },
    {
        key: Permission.PROJECTS_DELETE,
        module: "projects",
        label: "Xóa dự án",
        description: "Xóa dự án số hóa khỏi hệ thống",
    },

    {
        key: Permission.AUDIT_LOGS_READ,
        module: "audit_logs",
        label: "Xem nhật ký hệ thống",
        description: "Tra cứu log thao tác và sự kiện trong hệ thống",
    },

    {
        key: Permission.DASHBOARD_EDITOR,
        module: "dashboard",
        label: "Dashboard biên tập",
        description: "Xem thống kê tiến độ nhập liệu và hiệu suất cá nhân của editor",
    },
    {
        key: Permission.DASHBOARD_QC,
        module: "dashboard",
        label: "Dashboard QC",
        description: "Xem thống kê duyệt hồ sơ, hiệu suất QC cá nhân và dashboard nhóm (trưởng nhóm)",
    },
    {
        key: Permission.DASHBOARD_ADMIN,
        module: "dashboard",
        label: "Dashboard quản trị",
        description: "Xem tổng quan hệ thống, biểu đồ tiến độ hồ sơ và hiệu suất theo nhóm/dự án",
    },

    {
        key: Permission.DATA_ENTRY_MAKER,
        module: "data-entry",
        label: "Nhập liệu",
        description: "Nhận hồ sơ được phân công, nhập và gửi metadata ",
    },
    {
        key: Permission.DATA_ENTRY_CHECKER,
        module: "data-entry",
        label: "Kiểm tra QC",
        description: "Duyệt hoặc từ chối metadata đã nhập",
    },

    {
        key: Permission.METADATA_TEMPLATES_MANAGE,
        module: "metadata",
        label: "Quản lý mẫu metadata",
        description: "Tạo, sửa, xóa mẫu metadata dùng làm khung nhập liệu cho hồ sơ",
    },
    {
        key: Permission.METADATA_PERMISSIONS_MANAGE,
        module: "metadata",
        label: "Quản lý phân quyền trường metadata",
        description: "Cấu hình slot phân quyền từng trường metadata cho editor trong nhóm",
    },
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
