/** Rule keys Nhóm 1 — permission.<def.key> */
export const PermissionRuleKey = {
    view: "permission.view",
    downloadOriginal: "permission.download_original",
    downloadWatermark: "permission.download_watermark",
    export: "permission.export",
    print: "permission.print",
    share: "permission.share",
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
    { key: "view", name: "Xem", description: "Cho phép xem nội dung hồ sơ/file", isSystem: true },
    { key: "download_original", name: "Tải bản gốc", description: "Cho phép tải file gốc", isSystem: true },
    { key: "download_watermark", name: "Tải bản watermark", description: "Cho phép tải bản có watermark", isSystem: true },
    { key: "export", name: "Xuất", description: "Cho phép xuất dữ liệu hồ sơ", isSystem: true },
    { key: "print", name: "In", description: "Cho phép in trực tiếp", isSystem: true },
    { key: "share", name: "Chia sẻ/Chuyển tiếp", description: "Cho phép chia sẻ hoặc chuyển hồ sơ", isSystem: true },
] as const;

export const FLAG_RULE_KEYS = Object.values(FlagRuleKey);

/** Default values for lowest security level (system defaults). */
export const SYSTEM_DEFAULT_RULE_VALUES: Record<string, unknown> = {
    [PermissionRuleKey.view]: true,
    [PermissionRuleKey.downloadOriginal]: true,
    [PermissionRuleKey.downloadWatermark]: true,
    [PermissionRuleKey.export]: true,
    [PermissionRuleKey.print]: false,
    [PermissionRuleKey.share]: false,
    [FlagRuleKey.requirePassword]: false,
    [FlagRuleKey.requireWatermark]: false,
    [FlagRuleKey.requireEncryption]: false,
    [FlagRuleKey.limitExportActors]: { enabled: false, roleIds: [] as string[], userIds: [] as string[] },
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
