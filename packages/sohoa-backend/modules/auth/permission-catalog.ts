export const Permission = {
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  USERS_IMPORT: "users.import",
  USERS_EXPORT: "users.export",

  ROLES_MANAGE: "roles.manage",
  AUTH_TWO_FACTOR_REQUIRE: "roles.two_factor_require",

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
  DOSSIERS_DIRECT_APPROVE: "dossiers.direct_approve",
  DOSSIERS_METADATA_SUMMARY_EDIT: "dossiers.metadata.summary.edit",

  FOLDERS_BROWSE_ALL: "folders.browse_all",
  FOLDERS_BROWSE_ASSIGNED: "folders.browse_assigned",

  SCAN_INTAKE_USE: "scan-intake.use",
  OCR_CONTROL_MANAGE: "ocr-control.manage",

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

  /** @deprecated Prefer dashboard.personal.* section keys. */
  DASHBOARD_EDITOR: "dashboard.editor",
  /** @deprecated Prefer dashboard.personal.* / dashboard.team.qc_group. */
  DASHBOARD_QC: "dashboard.qc",
  /** @deprecated Prefer dashboard.overview.* / dashboard.team.*. */
  DASHBOARD_ADMIN: "dashboard.admin",
  /** @deprecated Use DASHBOARD_OVERVIEW_SUMMARY. */
  DASHBOARD_ADMIN_SUMMARY: "dashboard.admin.summary",
  /** @deprecated Use DASHBOARD_OVERVIEW_DOSSIER_STATUS_CHART. */
  DASHBOARD_ADMIN_DOSSIER_STATUS_CHART: "dashboard.admin.dossier_status_chart",
  /** @deprecated Use DASHBOARD_OVERVIEW_PROJECT_STATUS_CHART. */
  DASHBOARD_ADMIN_PROJECT_STATUS_CHART: "dashboard.admin.project_status_chart",
  /** @deprecated Use DASHBOARD_OVERVIEW_DOSSIER_TREND_CHART. */
  DASHBOARD_ADMIN_DOSSIER_TREND_CHART: "dashboard.admin.dossier_trend_chart",
  /** @deprecated Use DASHBOARD_OVERVIEW_SYSTEM_PERFORMANCE. */
  DASHBOARD_ADMIN_SYSTEM_PERFORMANCE: "dashboard.admin.system_performance",
  /** @deprecated Use DASHBOARD_TEAM_EMPLOYEE_KPIS. */
  DASHBOARD_ADMIN_EMPLOYEE_KPIS: "dashboard.admin.employee_kpis",
  /** @deprecated Use DASHBOARD_TEAM_GROUP_PERFORMANCE. */
  DASHBOARD_ADMIN_GROUP_PERFORMANCE_CHART: "dashboard.admin.group_performance_chart",
  DASHBOARD_ADMIN_UNASSIGNED: "dashboard.admin.unassigned",
  DASHBOARD_ADMIN_READ_ALL: "dashboard.admin.read_all",

  DASHBOARD_PERSONAL: "dashboard.personal",
  DASHBOARD_PERSONAL_EDITOR_SUMMARY: "dashboard.personal.editor_summary",
  DASHBOARD_PERSONAL_EDITOR_ACCURACY: "dashboard.personal.editor_accuracy",
  DASHBOARD_PERSONAL_EDITOR_PERFORMANCE: "dashboard.personal.editor_performance",
  DASHBOARD_PERSONAL_EDITOR_CHARTS: "dashboard.personal.editor_charts",
  DASHBOARD_PERSONAL_QC_SUMMARY: "dashboard.personal.qc_summary",
  DASHBOARD_PERSONAL_QC_BY_STEP: "dashboard.personal.qc_by_step",
  DASHBOARD_PERSONAL_QC_EFFICIENCY: "dashboard.personal.qc_efficiency",

  DASHBOARD_TEAM: "dashboard.team",
  DASHBOARD_TEAM_QC_GROUP: "dashboard.team.qc_group",
  DASHBOARD_TEAM_EMPLOYEE_KPIS: "dashboard.team.employee_kpis",
  DASHBOARD_TEAM_GROUP_PERFORMANCE: "dashboard.team.group_performance",

  DASHBOARD_OVERVIEW: "dashboard.overview",
  DASHBOARD_OVERVIEW_SUMMARY: "dashboard.overview.summary",
  DASHBOARD_OVERVIEW_DOSSIER_STATUS_CHART: "dashboard.overview.dossier_status_chart",
  DASHBOARD_OVERVIEW_PROJECT_STATUS_CHART: "dashboard.overview.project_status_chart",
  DASHBOARD_OVERVIEW_DOSSIER_TREND_CHART: "dashboard.overview.dossier_trend_chart",
  DASHBOARD_OVERVIEW_SYSTEM_PERFORMANCE: "dashboard.overview.system_performance",

  DASHBOARD_WAREHOUSE: "dashboard.warehouse",
  DASHBOARD_WAREHOUSE_DOSSIER_DISTRIBUTION: "dashboard.warehouse.dossier_distribution",
  DASHBOARD_WAREHOUSE_BORROW_STATS: "dashboard.warehouse.borrow_stats",
  DASHBOARD_WAREHOUSE_CAPACITY: "dashboard.warehouse.capacity",
  DASHBOARD_WAREHOUSE_INTAKE_CHART: "dashboard.warehouse.intake_chart",
  DASHBOARD_WAREHOUSE_UNPLACED: "dashboard.warehouse.unplaced",
  DASHBOARD_WAREHOUSE_FONDS: "dashboard.warehouse.fonds",
  DASHBOARD_WAREHOUSE_DISPOSAL: "dashboard.warehouse.disposal",

  DATA_ENTRY_MAKER: "data-entry.maker",
  DATA_ENTRY_CHECKER: "data-entry.checker",

  METADATA_TEMPLATES_MANAGE: "metadata.templates.manage",
  METADATA_PERMISSIONS_MANAGE: "metadata.permissions.manage",
  METADATA_EXPORT_PRESETS_MANAGE: "metadata.export_presets.manage",
  METADATA_NAMING_MANAGE: "metadata.naming.manage",
  METADATA_EXTRACT_SETTINGS_READ: "metadata.extract.settings.read",
  METADATA_EXTRACT_SETTINGS_UPDATE: "metadata.extract.settings.update",
  METADATA_EXTRACT_TRIGGER: "metadata.extract.trigger",
  METADATA_HIDDEN_FIELDS_READ: "metadata.hidden_fields.read",
  METADATA_HIDDEN_FIELDS_UPDATE: "metadata.hidden_fields.update",

  WATERMARK_CONFIG_READ: "watermark.config.read",
  WATERMARK_CONFIG_CREATE: "watermark.config.create",
  WATERMARK_CONFIG_UPDATE: "watermark.config.update",
  WATERMARK_CONFIG_DELETE: "watermark.config.delete",
  /** @deprecated Use security-level download rules instead of role download_* keys. */
  WATERMARK_CONFIG_DOWNLOAD: "watermark.config.download",
  /** @deprecated Prefer CREATE / UPDATE / DELETE / DOWNLOAD. Kept for legacy role rules. */
  WATERMARK_CONFIG_MANAGE: "watermark.config.manage",

  /** @deprecated Download gated by security-level permission.download_original instead. */
  ARCHIVE_WAREHOUSE_DOWNLOAD_ORIGINAL: "archive.warehouse.download_original",
  /** @deprecated Download gated by security-level permission.download_watermark instead. */
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
  ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY: "archive.warehouse.configure_security",
  ARCHIVE_WAREHOUSE_DELETE: "archive.warehouse.delete",
  ARCHIVE_WAREHOUSE_REUPLOAD: "archive.warehouse.reupload",
  /** Đặt mã PIN tải + nút tải/xuất tài liệu trong kho. */
  ARCHIVE_WAREHOUSE_DOWNLOAD: "archive.warehouse.download",
  ARCHIVE_PERMISSIONS_MANAGE: "archive.permissions.manage",
  ARCHIVE_DISPOSAL_READ: "archive.disposal.read",
  /** @deprecated Use CREATE / UPDATE / SUBMIT. Kept for legacy role rules. */
  ARCHIVE_DISPOSAL_MANAGE: "archive.disposal.manage",
  ARCHIVE_DISPOSAL_CREATE: "archive.disposal.create",
  ARCHIVE_DISPOSAL_UPDATE: "archive.disposal.update",
  ARCHIVE_DISPOSAL_SUBMIT: "archive.disposal.submit",
  ARCHIVE_DISPOSAL_COUNCIL_READ: "archive.disposal.council.read",
  ARCHIVE_DISPOSAL_COUNCIL_CREATE: "archive.disposal.council.create",
  ARCHIVE_DISPOSAL_COUNCIL_UPDATE: "archive.disposal.council.update",
  ARCHIVE_DISPOSAL_COUNCIL_FINALIZE: "archive.disposal.council.finalize",
  ARCHIVE_DISPOSAL_COUNCIL_PUBLISH: "archive.disposal.council.publish",
  ARCHIVE_DISPOSAL_COUNCIL_CHAIR_DECIDE:
    "archive.disposal.council.chair_decide",
  ARCHIVE_DISPOSAL_SETTINGS_MANAGE: "archive.disposal.settings.manage",
  ARCHIVE_DISPOSAL_DESTROY: "archive.disposal.destroy",
  ARCHIVE_BORROW_REQUEST: "library.borrow.request",
  ARCHIVE_BORROW_REVIEW: "library.borrow.review",
  LIBRARY_BORROW_APPROVAL_CONFIG_MANAGE:
    "library.borrow.approval-config.manage",
  LIBRARY_EXPLOITATION_READ: "library.exploitation.read",
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
  SECURITY_LEVELS_PERMISSION_DEFS_READ: "security-levels.permission-defs.read",
  SECURITY_LEVELS_PERMISSION_DEFS_MANAGE:
    "security-levels.permission-defs.manage",
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

/** Lookup active levels / unlock protected content while viewing dossiers — not catalog admin. */
export const SECURITY_LEVEL_CONTENT_ACCESS_PERMISSIONS = [
  Permission.SECURITY_LEVELS_READ,
  Permission.LIBRARY_EXPLOITATION_READ,
  Permission.ARCHIVE_WAREHOUSE_READ,
  Permission.ARCHIVE_WAREHOUSE_SEARCH,
  Permission.ARCHIVE_WAREHOUSE_EDIT,
  Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
  Permission.DOSSIERS_READ,
  Permission.ARCHIVE_BORROW_REQUEST,
  Permission.ARCHIVE_DISPOSAL_READ,
  Permission.ARCHIVE_SUBMIT,
  Permission.ARCHIVE_REVIEW,
  Permission.DATA_ENTRY_MAKER,
  Permission.DATA_ENTRY_CHECKER,
] as const;

/** Permissions that allow loading active Fond list for dropdowns/forms. */
export const FOND_ACTIVE_READ_PERMISSIONS = [
  Permission.FONDS_READ,
  Permission.DATA_ENTRY_MAKER,
  Permission.DATA_ENTRY_CHECKER,
  Permission.ARCHIVE_SUBMIT,
  Permission.ARCHIVE_REVIEW,
  Permission.ARCHIVE_CONFIG_MANAGE,
  Permission.ARCHIVE_WAREHOUSE_READ,
  Permission.ARCHIVE_WAREHOUSE_EDIT,
  Permission.ARCHIVE_WAREHOUSE_SEARCH,
  Permission.DOSSIERS_READ,
] as const;

/** Permissions that allow loading active Dossier Types list for dropdowns/forms. */
export const DOSSIER_TYPE_ACTIVE_READ_PERMISSIONS = [
  Permission.DOSSIER_TYPES_READ,
  Permission.DATA_ENTRY_MAKER,
  Permission.DATA_ENTRY_CHECKER,
  Permission.ARCHIVE_SUBMIT,
  Permission.ARCHIVE_REVIEW,
  Permission.ARCHIVE_CONFIG_MANAGE,
  Permission.ARCHIVE_WAREHOUSE_READ,
  Permission.ARCHIVE_WAREHOUSE_EDIT,
  Permission.ARCHIVE_WAREHOUSE_SEARCH,
  Permission.DOSSIERS_READ,
] as const;

/** Permissions that allow loading active Retention Periods list for dropdowns/forms. */
export const RETENTION_PERIOD_ACTIVE_READ_PERMISSIONS = [
  Permission.RETENTION_PERIODS_READ,
  Permission.DATA_ENTRY_MAKER,
  Permission.DATA_ENTRY_CHECKER,
  Permission.ARCHIVE_SUBMIT,
  Permission.ARCHIVE_REVIEW,
  Permission.ARCHIVE_CONFIG_MANAGE,
  Permission.ARCHIVE_WAREHOUSE_READ,
  Permission.ARCHIVE_WAREHOUSE_EDIT,
  Permission.ARCHIVE_WAREHOUSE_SEARCH,
  Permission.DOSSIERS_READ,
] as const;

/** Permissions that allow loading active Inventories list for dropdowns/forms. */
export const INVENTORY_ACTIVE_READ_PERMISSIONS = [
  Permission.INVENTORIES_READ,
  Permission.DATA_ENTRY_MAKER,
  Permission.DATA_ENTRY_CHECKER,
  Permission.ARCHIVE_SUBMIT,
  Permission.ARCHIVE_REVIEW,
  Permission.ARCHIVE_CONFIG_MANAGE,
  Permission.ARCHIVE_WAREHOUSE_READ,
  Permission.ARCHIVE_WAREHOUSE_EDIT,
  Permission.ARCHIVE_WAREHOUSE_SEARCH,
  Permission.DOSSIERS_READ,
] as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

export interface PermissionDefinition {
  key: PermissionKey | "*";
  module: string;
  label: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // --- MODULE 1: TỔNG QUAN ---
  {
    key: Permission.DASHBOARD_PERSONAL,
    module: "dashboard",
    label: "Dashboard cá nhân",
    description: "Xem các widget thống kê cá nhân (biên tập / QC) trên Dashboard",
  },
  {
    key: Permission.DASHBOARD_PERSONAL_EDITOR_SUMMARY,
    module: "dashboard",
    label: "KPI biên tập",
    description: "Xem thẻ số hồ sơ được gán / hoàn thành / đang xử lý của biên tập viên",
  },
  {
    key: Permission.DASHBOARD_PERSONAL_EDITOR_ACCURACY,
    module: "dashboard",
    label: "Độ chính xác biên tập",
    description: "Xem tỷ lệ đúng / sai của biên tập viên",
  },
  {
    key: Permission.DASHBOARD_PERSONAL_EDITOR_PERFORMANCE,
    module: "dashboard",
    label: "Hiệu suất biên tập",
    description: "Xem thời gian xử lý trung bình của biên tập viên",
  },
  {
    key: Permission.DASHBOARD_PERSONAL_EDITOR_CHARTS,
    module: "dashboard",
    label: "Biểu đồ biên tập",
    description: "Xem biểu đồ xu hướng hoàn thành và độ chính xác cá nhân",
  },
  {
    key: Permission.DASHBOARD_PERSONAL_QC_SUMMARY,
    module: "dashboard",
    label: "KPI QC cá nhân",
    description: "Xem thẻ số hồ sơ duyệt / từ chối / chờ duyệt của QC",
  },
  {
    key: Permission.DASHBOARD_PERSONAL_QC_BY_STEP,
    module: "dashboard",
    label: "QC theo bước",
    description: "Xem biểu đồ duyệt theo từng bước workflow",
  },
  {
    key: Permission.DASHBOARD_PERSONAL_QC_EFFICIENCY,
    module: "dashboard",
    label: "Hiệu suất QC",
    description: "Xem tỷ lệ duyệt / từ chối của QC",
  },
  {
    key: Permission.DASHBOARD_TEAM,
    module: "dashboard",
    label: "Dashboard đội nhóm / dự án",
    description: "Xem các widget thống kê đội nhóm và dự án trên Dashboard",
  },
  {
    key: Permission.DASHBOARD_TEAM_QC_GROUP,
    module: "dashboard",
    label: "Dashboard nhóm QC",
    description: "Xem tiến độ nhóm và hiệu suất thành viên (trưởng nhóm QC)",
  },
  {
    key: Permission.DASHBOARD_TEAM_EMPLOYEE_KPIS,
    module: "dashboard",
    label: "Bảng KPI nhân viên",
    description: "Xem bảng thống kê chi tiết sản lượng và tỷ lệ đúng của từng nhân viên",
  },
  {
    key: Permission.DASHBOARD_TEAM_GROUP_PERFORMANCE,
    module: "dashboard",
    label: "Biểu đồ hiệu suất tổ nhóm",
    description: "Xem biểu đồ sản lượng và tỷ lệ đúng trung bình của các tổ nhóm",
  },
  {
    key: Permission.DASHBOARD_OVERVIEW,
    module: "dashboard",
    label: "Dashboard tổng quan hệ thống",
    description: "Xem các widget tổng quan hệ thống trên Dashboard",
  },
  {
    key: Permission.DASHBOARD_OVERVIEW_SUMMARY,
    module: "dashboard",
    label: "Thẻ thống kê tổng quan",
    description: "Xem các thẻ thống kê tổng quan (Hồ sơ hệ thống, Dự án hệ thống, Hiệu suất duyệt)",
  },
  {
    key: Permission.DASHBOARD_OVERVIEW_DOSSIER_STATUS_CHART,
    module: "dashboard",
    label: "Biểu đồ trạng thái hồ sơ",
    description: "Xem biểu đồ phân bổ trạng thái hồ sơ số hóa",
  },
  {
    key: Permission.DASHBOARD_OVERVIEW_PROJECT_STATUS_CHART,
    module: "dashboard",
    label: "Biểu đồ trạng thái dự án",
    description: "Xem biểu đồ phân bổ trạng thái dự án số hóa",
  },
  {
    key: Permission.DASHBOARD_OVERVIEW_DOSSIER_TREND_CHART,
    module: "dashboard",
    label: "Biểu đồ xu hướng tiến độ hồ sơ",
    description: "Xem biểu đồ cột xu hướng hoàn thành hồ sơ theo tháng/quý",
  },
  {
    key: Permission.DASHBOARD_OVERVIEW_SYSTEM_PERFORMANCE,
    module: "dashboard",
    label: "Chỉ số hiệu suất hệ thống",
    description: "Xem các chỉ số thời gian xử lý trung bình và tỷ lệ duyệt toàn hệ thống",
  },
  {
    key: Permission.DASHBOARD_ADMIN_UNASSIGNED,
    module: "dashboard",
    label: "Xem tài liệu không gán dự án",
    description:
      "Cho phép hiển thị và thống kê các hồ sơ/tài liệu chưa được gán vào dự án nào trên Dashboard",
  },
  {
    key: Permission.DASHBOARD_ADMIN_READ_ALL,
    module: "dashboard",
    label: "Xem tất cả tài liệu toàn hệ thống",
    description:
      "Cho phép hiển thị và thống kê toàn bộ hồ sơ/dự án của tất cả các bộ phận trong hệ thống trên Dashboard",
  },
  {
    key: Permission.DASHBOARD_WAREHOUSE,
    module: "dashboard",
    label: "Dashboard kho",
    description: "Xem các widget thống kê kho lưu trữ trên Dashboard",
  },
  {
    key: Permission.DASHBOARD_WAREHOUSE_DOSSIER_DISTRIBUTION,
    module: "dashboard",
    label: "Phân bố hồ sơ kho",
    description: "Xem biểu đồ phân bố hồ sơ theo mức độ lưu trữ và chỉnh lý",
  },
  {
    key: Permission.DASHBOARD_WAREHOUSE_BORROW_STATS,
    module: "dashboard",
    label: "Thống kê mượn hồ sơ",
    description: "Xem thống kê yêu cầu mượn / tra cứu hồ sơ",
  },
  {
    key: Permission.DASHBOARD_WAREHOUSE_CAPACITY,
    module: "dashboard",
    label: "Dung lượng kho",
    description: "Xem sức chứa và mức sử dụng theo vị trí kho vật lý",
  },
  {
    key: Permission.DASHBOARD_WAREHOUSE_INTAKE_CHART,
    module: "dashboard",
    label: "Biểu đồ nạp kho",
    description: "Xem biểu đồ hồ sơ nạp vào kho theo ngày/tháng",
  },
  {
    key: Permission.DASHBOARD_WAREHOUSE_UNPLACED,
    module: "dashboard",
    label: "Hồ sơ chưa xếp vị trí",
    description: "Xem danh sách hồ sơ chưa được phân vị trí kho",
  },
  {
    key: Permission.DASHBOARD_WAREHOUSE_FONDS,
    module: "dashboard",
    label: "Phân bố theo phông",
    description: "Xem biểu đồ hồ sơ theo phông lưu trữ",
  },
  {
    key: Permission.DASHBOARD_WAREHOUSE_DISPOSAL,
    module: "dashboard",
    label: "Hồ sơ đến hạn tiêu hủy",
    description: "Xem danh sách hồ sơ sắp/đã hết hạn tiêu hủy",
  },

  // --- MODULE 2: SỐ HÓA ---
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
    description:
      "Xem toàn bộ nhóm làm việc trên hệ thống, không giới hạn theo thành viên",
  },
  {
    key: Permission.GROUPS_CREATE,
    module: "groups",
    label: "Tạo nhóm",
    description: "Tạo nhóm làm việc mới",
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
    key: Permission.SCAN_INTAKE_USE,
    module: "scan-intake",
    label: "Sử dụng Scan Intake",
    description:
      "Sử dụng màn quét tài liệu, quản lý phiên scan và đẩy tài liệu vào hệ thống",
  },
  {
    key: Permission.OCR_CONTROL_MANAGE,
    module: "ocr-control",
    label: "Kiểm soát OCR",
    description:
      "Tùy chỉnh chế độ OCR (Tự động/Thủ công) khi tải/đẩy dữ liệu và sử dụng màn hình Kiểm soát OCR",
  },
  {
    key: Permission.DATA_ENTRY_MAKER,
    module: "data-entry",
    label: "Biên tập (Maker)",
    description:
      "Nhận hồ sơ được phân công, nhập và gửi metadata (giao diện biên tập)",
  },
  {
    key: Permission.DATA_ENTRY_CHECKER,
    module: "data-entry",
    label: "Duyệt (Checker)",
    description: "Duyệt hoặc từ chối metadata đã nhập (giao diện QC)",
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
    key: Permission.DOSSIERS_DIRECT_APPROVE,
    module: "dossiers",
    label: "Duyệt hồ sơ trực tiếp (không qua phân công)",
    description:
      "Cho phép duyệt hoặc từ chối hồ sơ ở các bước QC mà không cần nằm trong danh sách phân công",
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
    label: "Tất cả thư mục",
    description: "Xem toàn bộ cây thư mục trên hệ thống",
  },
  {
    key: Permission.FOLDERS_BROWSE_ASSIGNED,
    module: "folders",
    label: "Thư mục được chỉ định",
    description: "Xem cây thư mục thuộc các dự án được gán làm quản lý dự án",
  },

  // --- MODULE 3: QUẢN LÝ KHO ---
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
    description:
      "Sửa thông tin / metadata hồ sơ đã lưu kho theo phạm vi được gán",
  },
  {
    key: Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
    module: "archive.warehouse",
    label: "Cấu hình bảo mật trong kho",
    description:
      "Cấu hình cấp bảo mật và mật khẩu riêng cho hồ sơ và file đã lưu kho theo phạm vi được gán",
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
    key: Permission.ARCHIVE_WAREHOUSE_DOWNLOAD,
    module: "archive.warehouse",
    label: "Tải tài liệu trong kho",
    description:
      "Đặt mã PIN tải và dùng nút tải/xuất tài liệu trong kho lưu trữ",
  },
  {
    key: Permission.ARCHIVE_PERMISSIONS_MANAGE,
    module: "archive.warehouse",
    label: "Cấu hình phân quyền kho",
    description:
      "Cấu hình phân quyền quản lý kho theo phông / loại hồ sơ / loại tài liệu",
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
    key: Permission.PHYSICAL_WAREHOUSE_ITEM_READ,
    module: "physical-warehouse",
    label: "Xem kho vật lý",
    description:
      "Xem sơ đồ kho, quản lý cấu trúc bên trong kho, hộp/cặp và xếp hồ sơ",
  },
  {
    key: Permission.PHYSICAL_WAREHOUSE_LOCATION_MANAGE,
    module: "physical-warehouse",
    label: "Quản lý địa điểm kho",
    description: "Thêm, sửa, xóa địa điểm kho vật lý",
  },
  {
    key: Permission.PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE,
    module: "physical-warehouse",
    label: "Quản lý kho vật lý",
    description: "Thêm, sửa, xóa kho trong các địa điểm",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_READ,
    module: "archive.disposal",
    label: "Xem hết hạn và trùng lặp",
    description:
      "Xem danh sách hồ sơ sắp hết hạn, đã hết hạn, trùng lặp và danh mục đề xuất hủy",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_CREATE,
    module: "archive.disposal",
    label: "Tạo đề xuất hủy",
    description: "Tạo danh mục đề xuất hủy và chuyển hồ sơ sang danh mục mới",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_UPDATE,
    module: "archive.disposal",
    label: "Sửa đề xuất hủy",
    description: "Cập nhật danh mục, thêm hoặc xóa hồ sơ và ghi lý do hủy",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_SUBMIT,
    module: "archive.disposal",
    label: "Trình duyệt đề xuất hủy",
    description: "Trình duyệt danh mục đề xuất hủy",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_COUNCIL_READ,
    module: "archive.disposal",
    label: "Xem Hội đồng xét hủy",
    description: "Xem danh sách, chi tiết và lịch sử Hội đồng xét hủy",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_COUNCIL_CREATE,
    module: "archive.disposal",
    label: "Tạo Hội đồng xét hủy",
    description:
      "Thành lập Hội đồng xét hủy và sao chép thành viên từ đợt trước",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_COUNCIL_UPDATE,
    module: "archive.disposal",
    label: "Sửa thành phần Hội đồng",
    description: "Thêm hoặc bớt thành viên Hội đồng xét hủy",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_COUNCIL_FINALIZE,
    module: "archive.disposal",
    label: "Phê duyệt kết quả Hội đồng xét hủy",
    description:
      "Quyết định cuối đồng ý hoặc từ chối hủy danh mục sau khi Hội đồng hoàn tất đánh giá",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_COUNCIL_PUBLISH,
    module: "archive.disposal",
    label: "Xuất bản Quyết định Hội đồng xét hủy",
    description:
      "Tạo PDF Quyết định và khóa đánh giá sau khi Hội đồng hoàn tất phiếu",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_COUNCIL_CHAIR_DECIDE,
    module: "archive.disposal",
    label: "Chủ tịch quyết định khi hòa phiếu",
    description:
      "Chủ tịch Hội đồng chốt Hủy/Không hủy khi phiếu hòa trên từng đơn vị đánh giá",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_SETTINGS_MANAGE,
    module: "archive.disposal",
    label: "Cấu hình xét hủy",
    description: "Bật hoặc tắt quy trình Hội đồng thẩm tra xét hủy",
  },
  {
    key: Permission.ARCHIVE_DISPOSAL_DESTROY,
    module: "archive.disposal",
    label: "Thực hiện hủy danh mục",
    description: "Thực hiện hủy danh mục đề xuất (khi quy trình Hội đồng tắt)",
  },

  // --- MODULE 4: KHAI THÁC DỮ LIỆU ---
  {
    key: Permission.LIBRARY_EXPLOITATION_READ,
    module: "library",
    label: "Khai thác hồ sơ chia sẻ",
    description:
      "Xem và tra cứu danh sách hồ sơ, chi tiết hồ sơ đã lưu kho được phép chia sẻ",
  },
  {
    key: Permission.ARCHIVE_BORROW_REQUEST,
    module: "library",
    label: "Đăng ký mượn tài liệu điện tử",
    description:
      "Gửi phiếu mượn tài liệu điện tử, kích hoạt và xem bản DIP trong hạn",
  },
  {
    key: Permission.ARCHIVE_BORROW_REVIEW,
    module: "library",
    label: "Duyệt mượn tài liệu điện tử",
    description:
      "Phê duyệt hoặc từ chối phiếu mượn tài liệu điện tử trong phạm vi được gán",
  },
  {
    key: Permission.LIBRARY_BORROW_APPROVAL_CONFIG_MANAGE,
    module: "library",
    label: "Cấu hình cấp duyệt mượn",
    description:
      "Gán vai trò với cấp bảo mật tối đa được phép duyệt phiếu mượn tài liệu điện tử",
  },

  // --- MODULE 5: QUẢN TRỊ HỆ THỐNG ---
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
    key: Permission.AUTH_TWO_FACTOR_REQUIRE,
    module: "roles",
    label: "Yêu cầu xác thực 2 lớp (2FA)",
    description:
      "Bắt buộc người dùng thuộc vai trò này phải nhập mã OTP gửi qua Email khi đăng nhập",
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
    description: "Cấu hình quyền/cờ (kế thừa & ghi đè) và mật khẩu cấp",
  },
  {
    key: Permission.SECURITY_LEVELS_PERMISSION_DEFS_READ,
    module: "security-levels",
    label: "Xem danh sách quyền bảo mật",
    description: "Xem danh mục quyền bảo mật dùng khi cấu hình từng cấp",
  },
  {
    key: Permission.SECURITY_LEVELS_PERMISSION_DEFS_MANAGE,
    module: "security-levels",
    label: "Quản lý danh sách quyền bảo mật",
    description: "Tạo, sửa, bật/tắt và xóa quyền bảo mật trong danh mục",
  },
  {
    key: Permission.AUDIT_LOGS_READ,
    module: "audit_logs",
    label: "Xem lịch sử thao tác hệ thống",
    description: "Tra cứu log thao tác và sự kiện trong hệ thống",
  },
  {
    key: Permission.AUDIT_LOGS_CONFIG,
    module: "audit_logs",
    label: "Cấu hình lịch sử thao tác hệ thống",
    description: "Bật/tắt ghi log theo chức năng và cấu hình thời gian lưu trữ",
  },
  {
    key: Permission.AUDIT_LOGS_DELETE,
    module: "audit_logs",
    label: "Xóa lịch sử thao tác hệ thống",
    description: "Xóa lịch sử thao tác để giảm tải hệ thống",
  },
  {
    key: Permission.AUDIT_LOGS_EXPORT,
    module: "audit_logs",
    label: "Xuất lịch sử thao tác hệ thống",
    description: "Xuất và tải về báo cáo lịch sử thao tác hệ thống",
  },
  {
    key: Permission.METADATA_TEMPLATES_MANAGE,
    module: "metadata",
    label: "Quản lý loại tài liệu & mẫu metadata",
    description: "Cấu hình loại tài liệu và mẫu metadata nhập liệu cho hồ sơ",
  },
  {
    key: Permission.METADATA_PERMISSIONS_MANAGE,
    module: "metadata",
    label: "Quản lý phân công tài liệu",
    description:
      "Cấu hình phân quyền trường metadata theo slot cho editor trong nhóm",
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
    key: Permission.METADATA_EXTRACT_SETTINGS_READ,
    module: "metadata",
    label: "Xem chế độ bóc tách metadata",
    description:
      "Xem cấu hình toàn hệ thống chọn luồng bóc tách (old / TT05 / tắt tự động)",
  },
  {
    key: Permission.METADATA_EXTRACT_SETTINGS_UPDATE,
    module: "metadata",
    label: "Sửa chế độ bóc tách metadata",
    description:
      "Cập nhật chế độ bóc tách metadata toàn hệ thống sau khi OCR merge",
  },
  {
    key: Permission.METADATA_EXTRACT_TRIGGER,
    module: "metadata",
    label: "Kích hoạt bóc tách metadata",
    description: "Kích hoạt tay hoặc bóc tách lại metadata (old / TT05 / both)",
  },
  {
    key: Permission.METADATA_HIDDEN_FIELDS_READ,
    module: "metadata",
    label: "Xem cấu hình ẩn/hiện trường Metadata",
    description:
      "Xem danh sách cấu hình ẩn hoặc hiển thị các trường metadata ở màn hình quản lý dữ liệu",
  },
  {
    key: Permission.METADATA_HIDDEN_FIELDS_UPDATE,
    module: "metadata",
    label: "Cập nhật cấu hình ẩn/hiện trường Metadata",
    description:
      "Thêm, sửa, xóa cấu hình ẩn hoặc hiển thị các trường metadata ở màn hình quản lý dữ liệu",
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
    description:
      "Chỉnh sửa cấu hình placement watermark (độ mờ, vị trí, kích thước)",
  },
  {
    key: Permission.WATERMARK_CONFIG_DELETE,
    module: "watermark",
    label: "Xóa cấu hình watermark",
    description: "Xóa ảnh watermark và cấu hình placement",
  },
  {
    key: Permission.NOTIFICATIONS_CONFIG_MANAGE,
    module: "notifications",
    label: "Cấu hình thông báo",
    description:
      "Cấu hình loại thông báo, kênh gửi, vai trò nhận và email sender",
  },
];

/** Keys removed from Function Matrix UI but still valid in role rules / runtime checks. */
const LEGACY_PERMISSION_KEYS = [
  Permission.SEARCH_GLOBAL,
  Permission.ARCHIVE_WAREHOUSE_SEARCH,
  Permission.WATERMARK_CONFIG_MANAGE,
  Permission.WATERMARK_CONFIG_DOWNLOAD,
  Permission.ARCHIVE_WAREHOUSE_DOWNLOAD_ORIGINAL,
  Permission.ARCHIVE_WAREHOUSE_DOWNLOAD_WATERMARK,
  Permission.ARCHIVE_DISPOSAL_MANAGE,
  "physical-warehouse.item.manage",
  /** Pre-library merge borrow keys (still accepted in role JSON). */
  "archive.borrow.request",
  "archive.borrow.review",
  /** Pre-modular dashboard role/page keys. */
  Permission.DASHBOARD_EDITOR,
  Permission.DASHBOARD_QC,
  Permission.DASHBOARD_ADMIN,
  Permission.DASHBOARD_ADMIN_SUMMARY,
  Permission.DASHBOARD_ADMIN_DOSSIER_STATUS_CHART,
  Permission.DASHBOARD_ADMIN_PROJECT_STATUS_CHART,
  Permission.DASHBOARD_ADMIN_DOSSIER_TREND_CHART,
  Permission.DASHBOARD_ADMIN_SYSTEM_PERFORMANCE,
  Permission.DASHBOARD_ADMIN_EMPLOYEE_KPIS,
  Permission.DASHBOARD_ADMIN_GROUP_PERFORMANCE_CHART,
] as const;

export const DASHBOARD_PERSONAL_SECTION_PERMISSIONS = [
  Permission.DASHBOARD_PERSONAL_EDITOR_SUMMARY,
  Permission.DASHBOARD_PERSONAL_EDITOR_ACCURACY,
  Permission.DASHBOARD_PERSONAL_EDITOR_PERFORMANCE,
  Permission.DASHBOARD_PERSONAL_EDITOR_CHARTS,
  Permission.DASHBOARD_PERSONAL_QC_SUMMARY,
  Permission.DASHBOARD_PERSONAL_QC_BY_STEP,
  Permission.DASHBOARD_PERSONAL_QC_EFFICIENCY,
] as const;

export const DASHBOARD_PERSONAL_EDITOR_PERMISSIONS = [
  Permission.DASHBOARD_PERSONAL_EDITOR_SUMMARY,
  Permission.DASHBOARD_PERSONAL_EDITOR_ACCURACY,
  Permission.DASHBOARD_PERSONAL_EDITOR_PERFORMANCE,
  Permission.DASHBOARD_PERSONAL_EDITOR_CHARTS,
] as const;

export const DASHBOARD_PERSONAL_QC_PERMISSIONS = [
  Permission.DASHBOARD_PERSONAL_QC_SUMMARY,
  Permission.DASHBOARD_PERSONAL_QC_BY_STEP,
  Permission.DASHBOARD_PERSONAL_QC_EFFICIENCY,
] as const;

export const DASHBOARD_TEAM_SECTION_PERMISSIONS = [
  Permission.DASHBOARD_TEAM_QC_GROUP,
  Permission.DASHBOARD_TEAM_EMPLOYEE_KPIS,
  Permission.DASHBOARD_TEAM_GROUP_PERFORMANCE,
] as const;

export const DASHBOARD_OVERVIEW_SECTION_PERMISSIONS = [
  Permission.DASHBOARD_OVERVIEW_SUMMARY,
  Permission.DASHBOARD_OVERVIEW_DOSSIER_STATUS_CHART,
  Permission.DASHBOARD_OVERVIEW_PROJECT_STATUS_CHART,
  Permission.DASHBOARD_OVERVIEW_DOSSIER_TREND_CHART,
  Permission.DASHBOARD_OVERVIEW_SYSTEM_PERFORMANCE,
] as const;

export const DASHBOARD_WAREHOUSE_SECTION_PERMISSIONS = [
  Permission.DASHBOARD_WAREHOUSE_DOSSIER_DISTRIBUTION,
  Permission.DASHBOARD_WAREHOUSE_BORROW_STATS,
  Permission.DASHBOARD_WAREHOUSE_CAPACITY,
  Permission.DASHBOARD_WAREHOUSE_INTAKE_CHART,
  Permission.DASHBOARD_WAREHOUSE_UNPLACED,
  Permission.DASHBOARD_WAREHOUSE_FONDS,
  Permission.DASHBOARD_WAREHOUSE_DISPOSAL,
] as const;

/** @deprecated Prefer DASHBOARD_OVERVIEW_SECTION_PERMISSIONS + DASHBOARD_TEAM_SECTION_PERMISSIONS. */
export const DASHBOARD_ADMIN_SUB_PERMISSIONS = [
  Permission.DASHBOARD_ADMIN_SUMMARY,
  Permission.DASHBOARD_ADMIN_DOSSIER_STATUS_CHART,
  Permission.DASHBOARD_ADMIN_PROJECT_STATUS_CHART,
  Permission.DASHBOARD_ADMIN_DOSSIER_TREND_CHART,
  Permission.DASHBOARD_ADMIN_SYSTEM_PERFORMANCE,
  Permission.DASHBOARD_ADMIN_EMPLOYEE_KPIS,
  Permission.DASHBOARD_ADMIN_GROUP_PERFORMANCE_CHART,
  Permission.DASHBOARD_ADMIN_UNASSIGNED,
  Permission.DASHBOARD_ADMIN_READ_ALL,
  Permission.DASHBOARD_OVERVIEW,
  ...DASHBOARD_OVERVIEW_SECTION_PERMISSIONS,
  Permission.DASHBOARD_TEAM,
  Permission.DASHBOARD_TEAM_EMPLOYEE_KPIS,
  Permission.DASHBOARD_TEAM_GROUP_PERFORMANCE,
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
