/** Column layout of `assets/Export_Metadata_Template.xlsx` (row 1 = headers). */

export const METADATA_EXPORT_MAIN_ROW = 2;
export const METADATA_EXPORT_CHU_DONG_ROWS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export const METADATA_EXPORT_FIXED_COLUMNS = {
    STT: 2,
    LOAI_TAI_LIEU: 3,
    TEN_VAN_BAN: 4,
    TRICH_YEU: 5,
    PATH: 96,
} as const;

/** Static fields per metadata group (record index 1 for indexed groups). */
export const GROUP_FIELD_COLUMNS: Record<string, Record<string, number>> = {
    BAN_AN_QUYET_DINH: {
        SO_BAN_AN: 6,
        NGAY_BAN_HANH_AN_QD: 7,
        LOAI_BAN_AN_QD: 8,
        CAP_XET_XU: 9,
        CO_QUAN_BAN_HANH: 10,
    },
    QUYET_DINH: {
        SO_QD_THA: 11,
        NGAY_QUYET_DINH: 12,
        CO_QUAN_BAN_HANH_QUYET_DINH: 13,
        NGUOI_RA_QD: 14,
        CHUC_DANH_NGUOI_RA_QD: 15,
        LOAI_QD_THA: 16,
        NGAY_HIEU_LUC_QD: 17,
    },
    DUONG_SU: {
        HO_VA_TEN: 18,
        SO_CMND: 19,
        SO_CCCD: 20,
        MA_SO_THUE: 21,
        HO_CHIEU: 22,
        NGAY_SINH: 23,
        THANG_SINH: 24,
        NAM_SINH: 25,
        QUOC_TICH: 26,
        DIA_CHI: 27,
        MA_XA_PHUONG: 28,
        MA_TINH_THANH_PHO: 29,
        SO_DIEN_THOAI_EMAIL: 30,
        LOAI_CHU_THE: 31,
    },
    NGHIA_VU: {
        LOAI_NGHIA_VU: 32,
        GIA_TRI_NGHIA_VU: 33,
        LOAI_TAI_SAN_LIEN_QUAN: 34,
        SO_LUONG_TAI_SAN: 35,
        TINH_TRANG_NGHIA_VU: 36,
    },
    THI_HANH_XONG: {
        SO_TIEN_THUC_THU: 37,
        NGAY_THU_TIEN: 38,
        LOAI_TIEN: 39,
    },
    DINH_CHI: {
        SO_QUYET_DINH: 40,
        NGAY_BAN_HANH: 41,
        CO_QUAN_BAN_HANH: 42,
        CAN_CU_PHAP_LY: 43,
        NOI_DUNG_NGHIA_VU: 44,
        NGAY_HIEU_LUC: 45,
    },
    NHAN_UY_THAC_THA: {
        SO_THONG_BAO: 46,
        NGAY_THONG_BAO: 47,
        CO_QUAN_THONG_BAO: 48,
    },
    UY_THAC_THA: {
        SO_QUYET_DINH: 49,
        NGAY_BAN_HANH: 50,
        CO_QUAN_BAN_HANH: 51,
        CAN_CU_PHAP_LY: 52,
        NOI_DUNG_UY_THAC: 53,
        NGHIA_VU_1_NOI_DUNG_NGHIA_VU: 54,
        NOI_NHAN_UY_THAC: 55,
        NGAY_HIEU_LUC: 56,
    },
};

/** Báo cáo đối chiếu — section prefix → first data column on row 1. */
export const BAO_CAO_RECEIVABLE_SECTIONS: Record<string, { startCol: number; rows: readonly number[] }> = {
    SO_PHAI_THU_CHU_DONG: { startCol: 58, rows: METADATA_EXPORT_CHU_DONG_ROWS },
    SO_PHAI_THU_THEO_DON: { startCol: 65, rows: [METADATA_EXPORT_MAIN_ROW] },
    SO_PHAI_THU_XAC_DINH_KHOAN_PHI_THA: { startCol: 73, rows: [METADATA_EXPORT_MAIN_ROW] },
    SO_PHAI_THU_CHI_PHI_THA: { startCol: 80, rows: [METADATA_EXPORT_MAIN_ROW] },
    SO_PHAI_THU_CAC_KHOAN_NOP_KHAC: { startCol: 88, rows: [METADATA_EXPORT_MAIN_ROW] },
};

export const BAO_CAO_FIELD_SUFFIX_OFFSET: Record<string, number> = {
    TIEU_CHI: 0,
    TONG_SO_TIEN_PHAI_THI_HANH: 1,
    SO_TIEN_DA_GIAI_QUYET_THEO_BIEN_PHAP: 2,
    SO_TIEN_DA_GIAI_QUYET: 3,
    SO_THUC_THU: 4,
    SO_DA_NOP_NSNN_CHI_TRA: 5,
    NGAY: 6,
};

const BAO_CAO_SECTION_PREFIXES = Object.keys(BAO_CAO_RECEIVABLE_SECTIONS)
    .sort((a, b) => b.length - a.length);

export function stripRecordIndex(fieldName: string): { index: number | null; baseName: string } {
    const startMatch = fieldName.match(/^_(\d+)_(.+)$/);
    if (startMatch) {
        return { index: Number.parseInt(startMatch[1], 10), baseName: startMatch[2] };
    }
    return { index: null, baseName: fieldName };
}

export function parseBaoCaoReceivableField(
    fieldName: string,
): { section: string; recordIndex: number; suffix: string } | null {
    for (const section of BAO_CAO_SECTION_PREFIXES) {
        const prefix = `${section}_`;
        if (!fieldName.startsWith(prefix)) {
            continue;
        }
        const rest = fieldName.slice(prefix.length);
        const match = rest.match(/^(\d+)_(.+)$/);
        if (!match) {
            continue;
        }
        return {
            section,
            recordIndex: Number.parseInt(match[1], 10),
            suffix: match[2],
        };
    }
    return null;
}

export function resolveGroupFieldColumn(groupCode: string, fieldName: string): number | null {
    const { index, baseName } = stripRecordIndex(fieldName);
    if (index !== null && index !== 1) {
        return null;
    }
    return GROUP_FIELD_COLUMNS[groupCode]?.[baseName] ?? null;
}

export function resolveBaoCaoFieldColumn(section: string, suffix: string): number | null {
    const offset = BAO_CAO_FIELD_SUFFIX_OFFSET[suffix];
    if (offset === undefined) {
        return null;
    }
    const startCol = BAO_CAO_RECEIVABLE_SECTIONS[section]?.startCol;
    if (!startCol) {
        return null;
    }
    return startCol + offset;
}
