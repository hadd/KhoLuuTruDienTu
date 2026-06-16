/** Column layout after removing unused template columns (row 1 = headers). */

export const METADATA_EXPORT_MAIN_ROW = 2;
export const METADATA_EXPORT_CHU_DONG_ROWS = [2, 3, 4, 5, 6, 7, 8, 9] as const;
export const METADATA_EXPORT_LAST_COL = 93;

/** Cột bị xóa khỏi template gốc khi chuẩn bị sheet export (theo thứ tự trái → phải). */
export const METADATA_EXPORT_REMOVED_COLUMN_SPLICES = [
    { startCol: 1, count: 1 }, // Trường thông tin
    { startCol: 3, count: 2 }, // Tên văn bản, Nội dung trích yếu
] as const;

export const METADATA_EXPORT_FIXED_COLUMNS = {
    STT: 1,
    LOAI_TAI_LIEU: 2,
    PATH: 93,
} as const;

/** Static fields per metadata group (record index 1 for indexed groups). */
export const GROUP_FIELD_COLUMNS: Record<string, Record<string, number>> = {
    BAN_AN_QUYET_DINH: {
        SO_BAN_AN: 3,
        NGAY_BAN_HANH_AN_QD: 4,
        LOAI_BAN_AN_QD: 5,
        CAP_XET_XU: 6,
        CO_QUAN_BAN_HANH: 7,
    },
    QUYET_DINH: {
        SO_QD_THA: 8,
        NGAY_QUYET_DINH: 9,
        CO_QUAN_BAN_HANH_QUYET_DINH: 10,
        NGUOI_RA_QD: 11,
        CHUC_DANH_NGUOI_RA_QD: 12,
        LOAI_QD_THA: 13,
        NGAY_HIEU_LUC_QD: 14,
    },
    DUONG_SU: {
        HO_VA_TEN: 15,
        SO_CMND: 16,
        SO_CCCD: 17,
        MA_SO_THUE: 18,
        HO_CHIEU: 19,
        NGAY_SINH: 20,
        THANG_SINH: 21,
        NAM_SINH: 22,
        QUOC_TICH: 23,
        DIA_CHI: 24,
        MA_XA_PHUONG: 25,
        MA_TINH_THANH_PHO: 26,
        SO_DIEN_THOAI_EMAIL: 27,
        LOAI_CHU_THE: 28,
    },
    NGHIA_VU: {
        LOAI_NGHIA_VU: 29,
        GIA_TRI_NGHIA_VU: 30,
        LOAI_TAI_SAN_LIEN_QUAN: 31,
        SO_LUONG_TAI_SAN: 32,
        TINH_TRANG_NGHIA_VU: 33,
    },
    THI_HANH_XONG: {
        SO_TIEN_THUC_THU: 34,
        NGAY_THU_TIEN: 35,
        LOAI_TIEN: 36,
    },
    DINH_CHI: {
        SO_QUYET_DINH: 37,
        NGAY_BAN_HANH: 38,
        CO_QUAN_BAN_HANH: 39,
        CAN_CU_PHAP_LY: 40,
        NOI_DUNG_NGHIA_VU: 41,
        NGAY_HIEU_LUC: 42,
    },
    NHAN_UY_THAC_THA: {
        SO_THONG_BAO: 43,
        NGAY_THONG_BAO: 44,
        CO_QUAN_THONG_BAO: 45,
    },
    UY_THAC_THA: {
        SO_QUYET_DINH: 46,
        NGAY_BAN_HANH: 47,
        CO_QUAN_BAN_HANH: 48,
        CAN_CU_PHAP_LY: 49,
        NOI_DUNG_UY_THAC: 50,
        NGHIA_VU_1_NOI_DUNG_NGHIA_VU: 51,
        NOI_NHAN_UY_THAC: 52,
        NGAY_HIEU_LUC: 53,
    },
};

/** Báo cáo đối chiếu — section prefix → first data column on row 1. */
export const BAO_CAO_RECEIVABLE_SECTIONS: Record<string, { startCol: number; rows: readonly number[] }> = {
    SO_PHAI_THU_CHU_DONG: { startCol: 55, rows: METADATA_EXPORT_CHU_DONG_ROWS },
    SO_PHAI_THU_THEO_DON: { startCol: 62, rows: [METADATA_EXPORT_MAIN_ROW] },
    SO_PHAI_THU_XAC_DINH_KHOAN_PHI_THA: { startCol: 70, rows: [METADATA_EXPORT_MAIN_ROW] },
    SO_PHAI_THU_CHI_PHI_THA: { startCol: 77, rows: [METADATA_EXPORT_MAIN_ROW] },
    SO_PHAI_THU_CAC_KHOAN_NOP_KHAC: { startCol: 85, rows: [METADATA_EXPORT_MAIN_ROW] },
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
