export const Permission = {
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  USERS_IMPORT: "users.import",
  USERS_EXPORT: "users.export",

  ROLES_MANAGE: "roles.manage",

  GROUPS_READ: "groups.read",
  GROUPS_READ_ALL: "groups.read_all",
  GROUPS_CREATE: "groups.create",
  GROUPS_UPDATE: "groups.update",
  GROUPS_DELETE: "groups.delete",
  GROUPS_MANAGE_MEMBERS: "groups.manage_members",
  GROUPS_START_WORKFLOW: "groups.start_workflow",

  DOSSIERS_READ: "dossiers.read",
  DOSSIERS_WRITE: "dossiers.write",
  DOSSIERS_ASSIGN: "dossiers.assign",
  DOSSIERS_EXPORT: "dossiers.export",
  DOSSIERS_SIGN: "dossiers.sign",
  DOSSIERS_METADATA_SUMMARY_EDIT: "dossiers.metadata.summary.edit",

  FOLDERS_BROWSE_ALL: "folders.browse_all",
  FOLDERS_BROWSE_ASSIGNED: "folders.browse_assigned",

  SCAN_INTAKE_USE: "scan-intake.use",

  PROJECTS_READ: "projects.read",
  PROJECTS_CREATE: "projects.create",
  PROJECTS_UPDATE: "projects.update",
  PROJECTS_DELETE: "projects.delete",

  PROJECT_PLANS_READ: "project-plans.read",
  PROJECT_PLANS_CREATE: "project-plans.create",
  PROJECT_PLANS_UPDATE: "project-plans.update",
  PROJECT_PLANS_DELETE: "project-plans.delete",

  AUDIT_LOGS_READ: "audit_logs.read",
  AUDIT_LOGS_CONFIG: "audit_logs.config",
  AUDIT_LOGS_DELETE: "audit_logs.delete",
  AUDIT_LOGS_EXPORT: "audit_logs.export",

  DASHBOARD_EDITOR: "dashboard.editor",
  DASHBOARD_QC: "dashboard.qc",
  DASHBOARD_ADMIN: "dashboard.admin",

  DATA_ENTRY_MAKER: "data-entry.maker",
  DATA_ENTRY_CHECKER: "data-entry.checker",

  METADATA_TEMPLATES_MANAGE: "metadata.templates.manage",
  METADATA_PERMISSIONS_MANAGE: "metadata.permissions.manage",
  METADATA_EXPORT_PRESETS_MANAGE: "metadata.export_presets.manage",
  METADATA_NAMING_MANAGE: "metadata.naming.manage",

  WATERMARK_CONFIG_READ: "watermark.config.read",
  WATERMARK_CONFIG_CREATE: "watermark.config.create",
  WATERMARK_CONFIG_UPDATE: "watermark.config.update",
  WATERMARK_CONFIG_DELETE: "watermark.config.delete",
  /** @deprecated Use ARCHIVE_WAREHOUSE_DOWNLOAD_ORIGINAL / ARCHIVE_WAREHOUSE_DOWNLOAD_WATERMARK instead. */
  WATERMARK_CONFIG_DOWNLOAD: "watermark.config.download",
  /** @deprecated Prefer CREATE / UPDATE / DELETE / DOWNLOAD. Kept for legacy role rules. */
  WATERMARK_CONFIG_MANAGE: "watermark.config.manage",

  ARCHIVE_WAREHOUSE_DOWNLOAD_ORIGINAL: "archive.warehouse.download_original",
  ARCHIVE_WAREHOUSE_DOWNLOAD_WATERMARK: "archive.warehouse.download_watermark",

    RETENTION_PERIODS_READ: "retention-periods.read",
    RETENTION_PERIODS_CREATE: "retention-periods.create",
    RETENTION_PERIODS_UPDATE: "retention-periods.update",
    RETENTION_PERIODS_DELETE: "retention-periods.delete",

    INVENTORIES_READ: "inventories.read",
    INVENTORIES_CREATE: "inventories.create",
    INVENTORIES_UPDATE: "inventories.update",
    INVENTORIES_DELETE: "inventories.delete",

    DOSSIER_TYPES_READ: "dossier-types.read",
    DOSSIER_TYPES_CREATE: "dossier-types.create",
    DOSSIER_TYPES_UPDATE: "dossier-types.update",
    DOSSIER_TYPES_DELETE: "dossier-types.delete",

    DOCUMENT_TYPES_READ: "document-types.read",
    DOCUMENT_TYPES_CREATE: "document-types.create",
    DOCUMENT_TYPES_UPDATE: "document-types.update",
    DOCUMENT_TYPES_DELETE: "document-types.delete",

  FONDS_READ: "fonds.read",
  FONDS_CREATE: "fonds.create",
  FONDS_UPDATE: "fonds.update",
  FONDS_DELETE: "fonds.delete",

  ARCHIVE_SUBMIT: "archive.submit",
  ARCHIVE_REVIEW: "archive.review",
  ARCHIVE_CONFIG_MANAGE: "archive.config.manage",
  ARCHIVE_WAREHOUSE_SEARCH: "archive.warehouse.search",
  ARCHIVE_WAREHOUSE_READ: "archive.warehouse.read",
  ARCHIVE_WAREHOUSE_EDIT: "archive.warehouse.edit",
  ARCHIVE_WAREHOUSE_DELETE: "archive.warehouse.delete",
  ARCHIVE_WAREHOUSE_REUPLOAD: "archive.warehouse.reupload",
  ARCHIVE_PERMISSIONS_MANAGE: "archive.permissions.manage",
  SEARCH_GLOBAL: "search.global",

  PHYSICAL_WAREHOUSE_ITEM_READ: "physical-warehouse.item.read",
  PHYSICAL_WAREHOUSE_LOCATION_MANAGE: "physical-warehouse.location.manage",
  PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE: "physical-warehouse.warehouse.manage",

  NOTIFICATIONS_CONFIG_MANAGE: "notifications.config.manage",

  SECURITY_LEVELS_READ: "security-levels.read",
  SECURITY_LEVELS_CREATE: "security-levels.create",
  SECURITY_LEVELS_UPDATE: "security-levels.update",
  SECURITY_LEVELS_DELETE: "security-levels.delete",
  SECURITY_LEVELS_CONFIG: "security-levels.config",
} as const;

/** Permissions that allow loading project code/name options for dropdowns (without full project management). */
export const PROJECT_SELECTION_READ_PERMISSIONS = [
  Permission.PROJECTS_READ,
  Permission.FOLDERS_BROWSE_ALL,
  Permission.FOLDERS_BROWSE_ASSIGNED,
  Permission.PROJECT_PLANS_READ,
  Permission.SCAN_INTAKE_USE,
  Permission.DATA_ENTRY_MAKER,
  Permission.DATA_ENTRY_CHECKER,
] as const;

/** Permissions that grant read access to dossier workflow data (assignments, history, issue reports). */
export const DOSSIER_WORKFLOW_DATA_PERMISSIONS = [
    Permission.DOSSIERS_READ,
    Permission.DATA_ENTRY_MAKER,
    Permission.DATA_ENTRY_CHECKER,
] as const;

/** Permissions that grant viewing digital-sign status/history for a dossier. */
export const DOSSIER_SIGN_VIEW_PERMISSIONS = [
    Permission.DOSSIERS_READ,
    Permission.DOSSIERS_SIGN,
    Permission.DATA_ENTRY_CHECKER,
] as const;

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
    label: "Xem thông tin người dùng",
    description:
      "Xem danh sách và thông tin chi tiết tài khoản người dùng trong hệ thống",
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
    label: "Sửa thông tin người dùng",
    description:
      "Cập nhật họ tên, email, vai trò và thông tin tài khoản người dùng",
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
    label: "Xuất thông tin người dùng",
    description: "Xuất danh sách người dùng ra file Excel",
  },
  {
    key: Permission.ROLES_MANAGE,
    module: "roles",
    label: "Quản lý phân quyền hệ thống",
    description: "Tạo, sửa, xóa vai trò và cấu hình ma trận quyền truy cập",
  },

  {
    key: Permission.GROUPS_READ,
    module: "groups",
    label: "Xem nhóm",
    description:
      "Xem danh sách nhóm làm việc (chỉ nhóm mình tham gia nếu không có quyền Hiển thị toàn nhóm)",
  },
  {
    key: Permission.GROUPS_READ_ALL,
    module: "groups",
    label: "Hiển thị toàn nhóm",
    description: "Xem toàn bộ nhóm làm việc trên hệ thống, không giới hạn theo thành viên",
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
    description:
      "Phân công hồ sơ cho thành viên theo thư mục và đồng bộ luồng duyệt của nhóm",
  },

  {
    key: Permission.DOSSIERS_READ,
    module: "dossiers",
    label: "Xem hồ sơ",
    description:
      "Xem danh sách, chi tiết hồ sơ, lịch sử metadata và file đính kèm",
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
    description:
      "Xuất metadata, gói DIP/AIP và file Excel theo hồ sơ hoặc bộ hồ sơ",
  },
  {
    key: Permission.DOSSIERS_SIGN,
    module: "dossiers",
    label: "Ký số hồ sơ",
    description: "Ký số USB Token cho file PDF trong hồ sơ đã duyệt",
  },
  {
    key: Permission.DOSSIERS_METADATA_SUMMARY_EDIT,
    module: "dossiers",
    label: "Sửa thông tin hồ sơ khi duyệt",
    description:
      "Cho phép chỉnh mã hồ sơ, trạng thái hồ sơ và thêm hoặc sửa các thông tin khác trong mục Thông tin hồ sơ, tại bước duyệt hồ sơ.",
  },

  {
    key: Permission.FOLDERS_BROWSE_ALL,
    module: "folders",
    label: "Tất cả",
    description: "Xem toàn bộ cây thư mục trên hệ thống",
  },
  {
    key: Permission.FOLDERS_BROWSE_ASSIGNED,
    module: "folders",
    label: "Được chỉ định",
    description: "Xem cây thư mục thuộc các dự án được gán làm quản lý dự án",
  },

  {
    key: Permission.SCAN_INTAKE_USE,
    module: "scan-intake",
    label: "Quét Tài Liệu",
    description:
      "Sử dụng màn quét tài liệu, quản lý phiên scan và đẩy tài liệu vào hệ thống",
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
    description:
      "Cập nhật thông tin dự án, tiến độ và gia hạn thời gian thực hiện",
  },
  {
    key: Permission.PROJECTS_DELETE,
    module: "projects",
    label: "Xóa dự án",
    description: "Xóa dự án số hóa khỏi hệ thống",
  },

  {
    key: Permission.PROJECT_PLANS_READ,
    module: "project-plans",
    label: "Xem kế hoạch dự án",
    description: "Xem danh sách và chi tiết kế hoạch triển khai dự án",
  },
  {
    key: Permission.PROJECT_PLANS_CREATE,
    module: "project-plans",
    label: "Tạo kế hoạch dự án",
    description: "Tạo kế hoạch triển khai mới cho dự án",
  },
  {
    key: Permission.PROJECT_PLANS_UPDATE,
    module: "project-plans",
    label: "Sửa kế hoạch dự án",
    description: "Cập nhật thông tin kế hoạch, khổ giấy và hạng mục công việc",
  },
  {
    key: Permission.PROJECT_PLANS_DELETE,
    module: "project-plans",
    label: "Xóa kế hoạch dự án",
    description: "Xóa kế hoạch triển khai dự án",
  },

  {
    key: Permission.AUDIT_LOGS_READ,
    module: "audit_logs",
    label: "Xem nhật ký hệ thống",
    description: "Tra cứu log thao tác và sự kiện trong hệ thống",
  },
  {
    key: Permission.AUDIT_LOGS_CONFIG,
    module: "audit_logs",
    label: "Cấu hình ghi nhật ký",
    description: "Bật/tắt ghi log theo chức năng và cấu hình thời gian lưu trữ",
  },
  {
    key: Permission.AUDIT_LOGS_DELETE,
    module: "audit_logs",
    label: "Xóa nhật ký hệ thống",
    description: "Xóa lịch sử thao tác để giảm tải hệ thống",
  },
  {
    key: Permission.AUDIT_LOGS_EXPORT,
    module: "audit_logs",
    label: "Xuất nhật ký hệ thống",
    description: "Xuất và tải về báo cáo nhật ký hệ thống",
  },

  {
    key: Permission.DASHBOARD_EDITOR,
    module: "dashboard",
    label: "Dashboard biên tập",
    description:
      "Xem thống kê tiến độ nhập liệu và hiệu suất cá nhân của biên tập viên",
  },
  {
    key: Permission.DASHBOARD_QC,
    module: "dashboard",
    label: "Dashboard QC",
    description:
      "Xem thống kê duyệt hồ sơ, hiệu suất QC cá nhân và dashboard nhóm (trưởng nhóm)",
  },
  {
    key: Permission.DASHBOARD_ADMIN,
    module: "dashboard",
    label: "Dashboard quản trị",
    description:
      "Xem tổng quan hệ thống, biểu đồ tiến độ hồ sơ và hiệu suất theo nhóm/dự án",
  },

  {
    key: Permission.DATA_ENTRY_MAKER,
    module: "data-entry",
    label: "Biên tập",
    description: "Nhận hồ sơ được phân công, nhập và gửi metadata (giao diện biên tập)",
  },
  {
    key: Permission.DATA_ENTRY_CHECKER,
    module: "data-entry",
    label: "Duyệt",
    description: "Duyệt hoặc từ chối metadata đã nhập (giao diện QC)",
  },

    {
        key: Permission.METADATA_TEMPLATES_MANAGE,
        module: "metadata",
        label: "Quản lý loại tài liệu",
        description: "Cấu hình loại tài liệu và mẫu metadata nhập liệu cho hồ sơ",
    },
    {
        key: Permission.METADATA_PERMISSIONS_MANAGE,
        module: "metadata",
        label: "Quản lý phân công tài liệu",
        description: "Cấu hình phân quyền trường metadata theo slot cho editor trong nhóm",
    },
    {
        key: Permission.METADATA_EXPORT_PRESETS_MANAGE,
        module: "metadata",
        label: "Quản lý mẫu xuất Excel",
        description: "Cấu hình mẫu xuất metadata ra file Excel",
    },
    {
        key: Permission.METADATA_NAMING_MANAGE,
        module: "metadata",
        label: "Cấu hình tên tài liệu",
        description: "Cấu hình quy tắc sinh tên hồ sơ và tên file theo phông",
    },
    {
        key: Permission.WATERMARK_CONFIG_READ,
        module: "watermark",
        label: "Xem cấu hình watermark",
        description: "Xem cấu hình watermark text/ảnh và lịch sử ảnh",
    },
    {
        key: Permission.WATERMARK_CONFIG_CREATE,
        module: "watermark",
        label: "Tạo cấu hình watermark",
        description: "Tải lên ảnh watermark mới và tạo cấu hình placement",
    },
    {
        key: Permission.WATERMARK_CONFIG_UPDATE,
        module: "watermark",
        label: "Sửa cấu hình watermark",
        description: "Chỉnh sửa cấu hình placement watermark (độ mờ, vị trí, kích thước)",
    },
    {
        key: Permission.WATERMARK_CONFIG_DELETE,
        module: "watermark",
        label: "Xóa cấu hình watermark",
        description: "Xóa ảnh watermark và cấu hình placement",
    },
    {
        key: Permission.FONDS_READ,
        module: "fonds",
        label: "Xem phông lưu trữ",
        description: "Xem danh sách phông lưu trữ",
    },
    {
        key: Permission.FONDS_CREATE,
        module: "fonds",
        label: "Thêm phông lưu trữ",
        description: "Thêm phông lưu trữ mới",
    },
    {
        key: Permission.FONDS_UPDATE,
        module: "fonds",
        label: "Sửa phông lưu trữ",
        description: "Sửa thông tin phông lưu trữ",
    },
    {
        key: Permission.FONDS_DELETE,
        module: "fonds",
        label: "Xóa phông lưu trữ",
        description: "Xóa phông lưu trữ",
    },
    {
        key: Permission.RETENTION_PERIODS_READ,
        module: "retention-periods",
        label: "Xem thời hạn lưu trữ",
        description: "Xem danh sách thời hạn lưu trữ",
    },
    {
        key: Permission.RETENTION_PERIODS_CREATE,
        module: "retention-periods",
        label: "Thêm thời hạn lưu trữ",
        description: "Thêm thời hạn lưu trữ mới",
    },
    {
        key: Permission.RETENTION_PERIODS_UPDATE,
        module: "retention-periods",
        label: "Sửa thời hạn lưu trữ",
        description: "Sửa thông tin thời hạn lưu trữ",
    },
    {
        key: Permission.RETENTION_PERIODS_DELETE,
        module: "retention-periods",
        label: "Xóa thời hạn lưu trữ",
        description: "Xóa thời hạn lưu trữ",
    },
    {
        key: Permission.INVENTORIES_READ,
        module: "inventories",
        label: "Xem mục lục",
        description: "Xem danh sách mục lục",
    },
    {
        key: Permission.INVENTORIES_CREATE,
        module: "inventories",
        label: "Thêm mục lục",
        description: "Thêm mục lục mới",
    },
    {
        key: Permission.INVENTORIES_UPDATE,
        module: "inventories",
        label: "Sửa mục lục",
        description: "Sửa thông tin mục lục",
    },
    {
        key: Permission.INVENTORIES_DELETE,
        module: "inventories",
        label: "Xóa mục lục",
        description: "Xóa mục lục",
    },
    {
        key: Permission.DOSSIER_TYPES_READ,
        module: "dossier-types",
        label: "Xem loại hồ sơ",
        description: "Xem danh sách loại hồ sơ",
    },
    {
        key: Permission.DOSSIER_TYPES_CREATE,
        module: "dossier-types",
        label: "Thêm loại hồ sơ",
        description: "Thêm loại hồ sơ mới",
    },
    {
        key: Permission.DOSSIER_TYPES_UPDATE,
        module: "dossier-types",
        label: "Sửa loại hồ sơ",
        description: "Sửa thông tin loại hồ sơ",
    },
    {
        key: Permission.DOSSIER_TYPES_DELETE,
        module: "dossier-types",
        label: "Xóa loại hồ sơ",
        description: "Xóa loại hồ sơ",
    },
    {
        key: Permission.DOCUMENT_TYPES_READ,
        module: "document-types",
        label: "Xem loại tài liệu",
        description: "Xem danh sách loại tài liệu (định danh file trong kho)",
    },
    {
        key: Permission.DOCUMENT_TYPES_CREATE,
        module: "document-types",
        label: "Thêm loại tài liệu",
        description: "Thêm loại tài liệu mới",
    },
    {
        key: Permission.DOCUMENT_TYPES_UPDATE,
        module: "document-types",
        label: "Sửa loại tài liệu",
        description: "Sửa thông tin loại tài liệu",
    },
    {
        key: Permission.DOCUMENT_TYPES_DELETE,
        module: "document-types",
        label: "Xóa loại tài liệu",
        description: "Xóa loại tài liệu",
    },
    {
        key: Permission.ARCHIVE_SUBMIT,
        module: "archive",
        label: "Nộp lưu kho",
        description: "Nộp hồ sơ đã duyệt vào quy trình lưu kho",
    },
    {
        key: Permission.ARCHIVE_REVIEW,
        module: "archive",
        label: "Duyệt lưu kho",
        description: "Duyệt hoặc từ chối đơn nộp lưu kho",
    },
    {
        key: Permission.ARCHIVE_CONFIG_MANAGE,
        module: "archive",
        label: "Cấu hình lưu kho",
        description: "Cấu hình các trường thông tin khi nộp lưu kho",
    },
    {
        key: Permission.ARCHIVE_WAREHOUSE_READ,
        module: "archive.warehouse",
        label: "Xem và tìm kiếm hồ sơ trong kho",
        description:
            "Xem hồ sơ đã lưu kho và tìm kiếm toàn văn theo phạm vi được gán",
    },
    {
        key: Permission.ARCHIVE_WAREHOUSE_EDIT,
        module: "archive.warehouse",
        label: "Sửa hồ sơ trong kho",
        description: "Sửa thông tin / metadata hồ sơ đã lưu kho theo phạm vi được gán",
    },
    {
        key: Permission.ARCHIVE_WAREHOUSE_DELETE,
        module: "archive.warehouse",
        label: "Xóa hồ sơ trong kho",
        description: "Xóa hồ sơ hoặc văn bản đã lưu kho theo phạm vi được gán",
    },
    {
        key: Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
        module: "archive.warehouse",
        label: "Upload lại file trong kho",
        description: "Upload lại PDF hồ sơ đã lưu kho để chạy lại OCR / biên tập",
    },
    {
        key: Permission.ARCHIVE_PERMISSIONS_MANAGE,
        module: "archive.warehouse",
        label: "Cấu hình phân quyền kho",
        description: "Cấu hình phân quyền quản lý kho theo phông / loại hồ sơ / loại tài liệu",
    },
    {
        key: Permission.ARCHIVE_WAREHOUSE_DOWNLOAD_ORIGINAL,
        module: "archive.warehouse",
        label: "Tải xuống bản gốc",
        description: "Tải xuống file PDF gốc từ kho (không có watermark)",
    },
    {
        key: Permission.ARCHIVE_WAREHOUSE_DOWNLOAD_WATERMARK,
        module: "archive.warehouse",
        label: "Tải xuống bản có watermark",
        description: "Tải xuống file PDF có đóng dấu watermark từ kho",
    },
    {
        key: Permission.PHYSICAL_WAREHOUSE_ITEM_READ,
        module: "physical-warehouse",
        label: "Xem kho vật lý",
        description: "Xem sơ đồ kho, quản lý cấu trúc bên trong kho, hộp/cặp và xếp hồ sơ",
    },
    {
        key: Permission.PHYSICAL_WAREHOUSE_LOCATION_MANAGE,
        module: "physical-warehouse",
        label: "Quản lý địa điểm",
        description: "Thêm, sửa, xóa địa điểm kho vật lý",
    },
    {
        key: Permission.PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE,
        module: "physical-warehouse",
        label: "Quản lý kho",
        description: "Thêm, sửa, xóa kho trong các địa điểm",
    },
    {
        key: Permission.NOTIFICATIONS_CONFIG_MANAGE,
        module: "notifications",
        label: "Cấu hình thông báo",
        description: "Cấu hình loại thông báo, kênh gửi, vai trò nhận và email sender",
    },
    {
        key: Permission.SECURITY_LEVELS_READ,
        module: "security-levels",
        label: "Xem cấp độ bảo mật",
        description: "Xem danh mục và thông tin cấp độ bảo mật",
    },
    {
        key: Permission.SECURITY_LEVELS_CREATE,
        module: "security-levels",
        label: "Tạo cấp độ bảo mật",
        description: "Tạo mới cấp độ bảo mật trong danh mục",
    },
    {
        key: Permission.SECURITY_LEVELS_UPDATE,
        module: "security-levels",
        label: "Sửa cấp độ bảo mật",
        description: "Cập nhật tên, mô tả, trạng thái cấp độ bảo mật",
    },
    {
        key: Permission.SECURITY_LEVELS_DELETE,
        module: "security-levels",
        label: "Xóa cấp độ bảo mật",
        description: "Xóa mềm cấp độ bảo mật (khi không còn hồ sơ gắn)",
    },
    {
        key: Permission.SECURITY_LEVELS_CONFIG,
        module: "security-levels",
        label: "Cấu hình bảo mật theo cấp",
        description: "Cấu hình quyền/cờ (kế thừa & ghi đè), danh mục quyền bảo mật và mật khẩu cấp",
    },
];

/** Keys removed from Function Matrix UI but still valid in role rules / runtime checks. */
const LEGACY_PERMISSION_KEYS = [
  Permission.SEARCH_GLOBAL,
  Permission.ARCHIVE_WAREHOUSE_SEARCH,
  Permission.WATERMARK_CONFIG_MANAGE,
  Permission.WATERMARK_CONFIG_DOWNLOAD,
  "physical-warehouse.item.manage",
] as const;

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map(
  (p) => p.key,
) as PermissionKey[];

const PERMISSION_KEY_SET = new Set<string>([
  ...ALL_PERMISSION_KEYS,
  ...LEGACY_PERMISSION_KEYS,
]);

export function isKnownPermissionKey(key: string): boolean {
  return key === "*" || PERMISSION_KEY_SET.has(key);
}

export function isValidPermissionPattern(pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return [...PERMISSION_KEY_SET].some((k) => k.startsWith(`${prefix}.`));
  }
  return isKnownPermissionKey(pattern);
}
