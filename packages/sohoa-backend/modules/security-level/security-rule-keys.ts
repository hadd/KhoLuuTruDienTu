/** Rule keys Nhóm 1 — permission.<def.key> */
export const PermissionRuleKey = {
  view: "permission.view",
  download: "permission.download",
  downloadWatermark: "permission.download_watermark",
  export: "permission.export",
  print: "permission.print",
  share: "permission.share",
  encryptDownload: "permission.encrypt_download",
  encryptDownloadDossier: "permission.encrypt_download_dossier",
  requireAccessPassword: "permission.require_access_password",
  requireFilePassword: "permission.require_file_password",
} as const;

/** Rule keys Nhóm 2 — flag.* */
export const FlagRuleKey = {
  requirePassword: "flag.require_password",
  requireWatermark: "flag.require_watermark",
  requireEncryption: "flag.require_encryption",
  limitExportActors: "flag.limit_export_actors",
  limitExportFormats: "flag.limit_export_formats",
  blockExportDownload: "flag.block_export_download",
} as const;

export type SecurityRuleKey =
  | (typeof PermissionRuleKey)[keyof typeof PermissionRuleKey]
  | (typeof FlagRuleKey)[keyof typeof FlagRuleKey]
  | `permission.${string}`;

export const SYSTEM_PERMISSION_DEFS = [
  {
    key: "view",
    name: "Xem",
    description: "Cho phép xem nội dung hồ sơ/file",
    isSystem: true,
  },
  {
    key: "download",
    name: "Tải tài liệu",
    description: "Cho phép tải file (không watermark)",
    isSystem: true,
  },
  {
    key: "download_watermark",
    name: "Watermark tài liệu",
    description: "Cho phép tải bản có đóng dấu watermark",
    isSystem: true,
  },
  // {
  //   key: "export",
  //   name: "Xuất",
  //   description: "Cho phép xuất dữ liệu hồ sơ",
  //   isSystem: true,
  // },
  // {
  //   key: "print",
  //   name: "In",
  //   description: "Cho phép in trực tiếp",
  //   isSystem: true,
  // },
  {
    key: "share",
    name: "Chia sẻ/Chuyển tiếp",
    description: "Cho phép chia sẻ hoặc chuyển hồ sơ",
    isSystem: true,
  },
  {
    key: "encrypt_download",
    name: "Mã hóa ZIP bằng PIN cá nhân",
    description:
      "Khóa file ZIP tải xuống bằng mã PIN cá nhân của người tải",
    isSystem: true,
  },
  {
    key: "encrypt_download_dossier",
    name: "Mã hóa ZIP bằng mật khẩu hồ sơ",
    description:
      "Khóa file ZIP tải xuống bằng mật khẩu truy cập hồ sơ/cấp (nhập lúc tải)",
    isSystem: true,
  },
  {
    key: "require_access_password",
    name: "Yêu cầu mật khẩu hồ sơ",
    description:
      "Xem/tải hồ sơ thuộc cấp này phải nhập mật khẩu hồ sơ (token theo từng hồ sơ)",
    isSystem: true,
  },
  {
    key: "require_file_password",
    name: "Yêu cầu mật khẩu file",
    description:
      "Xem/tải từng file thuộc cấp này phải nhập mật khẩu file (token theo từng file)",
    isSystem: true,
  },
] as const;

export const FLAG_RULE_KEYS = Object.values(FlagRuleKey);

/** Default values for lowest security level (system defaults). */
export const SYSTEM_DEFAULT_RULE_VALUES: Record<string, unknown> = {
  [PermissionRuleKey.view]: true,
  [PermissionRuleKey.download]: true,
  [PermissionRuleKey.downloadWatermark]: true,
  [PermissionRuleKey.export]: true,
  [PermissionRuleKey.print]: false,
  [PermissionRuleKey.share]: false,
  [PermissionRuleKey.encryptDownload]: false,
  [PermissionRuleKey.encryptDownloadDossier]: false,
  [PermissionRuleKey.requireAccessPassword]: false,
  [PermissionRuleKey.requireFilePassword]: false,
  [FlagRuleKey.requirePassword]: false,
  [FlagRuleKey.requireWatermark]: false,
  [FlagRuleKey.requireEncryption]: false,
  [FlagRuleKey.limitExportActors]: {
    enabled: false,
    roleIds: [] as string[],
    userIds: [] as string[],
  },
  [FlagRuleKey.limitExportFormats]: { enabled: false, formats: [] as string[] },
  [FlagRuleKey.blockExportDownload]: false,
};

export function permissionRuleKey(defKey: string): string {
  return `permission.${defKey}`;
}

export type ExportActorsValue = {
  enabled: boolean;
  roleIds: string[];
  userIds: string[];
};

export type ExportFormatsValue = {
  enabled: boolean;
  formats: string[];
};
