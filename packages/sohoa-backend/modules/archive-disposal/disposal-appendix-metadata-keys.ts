/** Metadata field names (TT05 / hồ sơ) — chỉnh khi BA chốt mapping phông. */
export const DISPOSAL_APPENDIX_METADATA_KEYS = {
    boxNumber: ["SO_BO", "BO_SO", "SO_BÓ"],
    volumeNumber: ["SO_TAP", "TAP_SO", "TAP"],
    archiveUnitOrFileNumber: ["MA_HO_SO", "SO_HO_SO", "SO_DVBQ", "MA_DVBQ"],
    dossierTitle: ["TIEU_DE_HO_SO", "TIEU_DE", "TEN_HO_SO", "TRICH_YEU"],
} as const;

export const DISPOSAL_APPENDIX_CIRCULAR_LABEL =
    Deno.env.get("DISPOSAL_APPENDIX_CIRCULAR_LABEL") ??
    "06/2025/TT-BNV ngày … tháng … năm 2025";
