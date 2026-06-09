/**
 * Static metadata schema derived from sample_metadata.json.
 * Dynamic fields (containing _N_) represent numbered variants
 * (e.g. _N_HO_VA_TEN matches _1_HO_VA_TEN, _2_HO_VA_TEN, …).
 *
 * This is the source of truth for field-level ACL configuration.
 */

export interface MetadataSchemaField {
    name: string;
    display: string;
}

export interface MetadataSchemaGroup {
    groupCode: string;
    groupName: string;
    isDynamic: boolean;
    fields: MetadataSchemaField[];
}

export const METADATA_SCHEMA: MetadataSchemaGroup[] = [
    {
        groupCode: "BAN_AN_QUYET_DINH",
        groupName: "Bản án, quyết định",
        isDynamic: false,
        fields: [
            { name: "SO_BAN_AN", display: "Số bản án" },
            { name: "NGAY_BAN_HANH_AN_QD", display: "Ngày ban hành án/Quyết định" },
            { name: "LOAI_BAN_AN_QD", display: "Loại bản án/Quyết định" },
            { name: "CAP_XET_XU", display: "Cấp xét xử" },
            { name: "CO_QUAN_BAN_HANH", display: "Cơ quan ban hành" },
        ],
    },
    {
        groupCode: "QUYET_DINH",
        groupName: "Quyết định THA",
        isDynamic: false,
        fields: [
            { name: "SO_QD_THA", display: "Số quyết định THA" },
            { name: "NGAY_QUYET_DINH", display: "Ngày ban hành quyết định" },
            { name: "CO_QUAN_BAN_HANH_QUYET_DINH", display: "Cơ quan ban hành quyết định" },
            { name: "NGUOI_RA_QD", display: "Người ra quyết định" },
            { name: "CHUC_DANH_NGUOI_RA_QD", display: "Chức danh người ra quyết định" },
            { name: "LOAI_QD_THA", display: "Loại quyết định THA" },
            { name: "NGAY_HIEU_LUC_QD", display: "Ngày hiệu lực" },
        ],
    },
    {
        groupCode: "DUONG_SU",
        groupName: "Đương sự",
        isDynamic: true,
        fields: [
            { name: "_N_HO_VA_TEN", display: "Họ và tên (đương sự N)" },
            { name: "_N_SO_CMND", display: "Số CMND (đương sự N)" },
            { name: "_N_SO_CCCD", display: "Số CCCD (đương sự N)" },
            { name: "_N_MA_SO_THUE", display: "Mã số thuế (đương sự N)" },
            { name: "_N_HO_CHIEU", display: "Số hộ chiếu (đương sự N)" },
            { name: "_N_NGAY_SINH", display: "Ngày sinh (đương sự N)" },
            { name: "_N_THANG_SINH", display: "Tháng sinh (đương sự N)" },
            { name: "_N_NAM_SINH", display: "Năm sinh (đương sự N)" },
            { name: "_N_QUOC_TICH", display: "Quốc tịch (đương sự N)" },
            { name: "_N_DIA_CHI", display: "Địa chỉ (đương sự N)" },
            { name: "_N_MA_XA_PHUONG", display: "Mã xã/phường (đương sự N)" },
            { name: "_N_MA_TINH_THANH_PHO", display: "Mã tỉnh/thành phố (đương sự N)" },
            { name: "_N_SO_DIEN_THOAI_EMAIL", display: "Số điện thoại/Email (đương sự N)" },
            { name: "_N_LOAI_CHU_THE", display: "Loại chủ thể (đương sự N)" },
        ],
    },
    {
        groupCode: "NGHIA_VU",
        groupName: "Nghĩa vụ thi hành án",
        isDynamic: true,
        fields: [
            { name: "_N_LOAI_NGHIA_VU", display: "Loại nghĩa vụ N" },
            { name: "_N_GIA_TRI_NGHIA_VU", display: "Giá trị nghĩa vụ N" },
            { name: "_N_LOAI_TAI_SAN_LIEN_QUAN", display: "Loại tài sản liên quan N" },
            { name: "_N_SO_LUONG_TAI_SAN", display: "Số lượng tài sản N" },
            { name: "_N_TINH_TRANG_NGHIA_VU", display: "Tình trạng nghĩa vụ N" },
        ],
    },
    {
        groupCode: "THI_HANH_XONG",
        groupName: "Thi hành xong (Biên lai)",
        isDynamic: false,
        fields: [
            { name: "SO_TIEN_THUC_THU", display: "Số tiền thực thu" },
            { name: "NGAY_THU_TIEN", display: "Ngày thu tiền" },
            { name: "LOAI_TIEN", display: "Loại tiền" },
        ],
    },
    {
        groupCode: "DINH_CHI",
        groupName: "Đình chỉ thi hành án",
        isDynamic: false,
        fields: [
            { name: "SO_QUYET_DINH", display: "Số quyết định" },
            { name: "NGAY_BAN_HANH", display: "Ngày ban hành" },
            { name: "CO_QUAN_BAN_HANH", display: "Cơ quan ban hành" },
            { name: "CAN_CU_PHAP_LY", display: "Căn cứ pháp lý" },
            { name: "NOI_DUNG_NGHIA_VU", display: "Nội dung nghĩa vụ" },
            { name: "NGAY_HIEU_LUC", display: "Ngày hiệu lực" },
        ],
    },
    {
        groupCode: "UY_THAC_THA",
        groupName: "Ủy thác thi hành án",
        isDynamic: true,
        fields: [
            { name: "SO_QUYET_DINH", display: "Số quyết định" },
            { name: "NGAY_BAN_HANH", display: "Ngày ban hành" },
            { name: "CO_QUAN_BAN_HANH", display: "Cơ quan ban hành" },
            { name: "CAN_CU_PHAP_LY", display: "Căn cứ pháp lý" },
            { name: "NOI_DUNG_UY_THAC", display: "Nội dung ủy thác" },
            { name: "NGHIA_VU_N_NOI_DUNG_NGHIA_VU", display: "Nội dung nghĩa vụ N" },
            { name: "NGHIA_VU_N_SO_TIEN_NGHIA_VU", display: "Số tiền nghĩa vụ N" },
            { name: "NOI_NHAN_UY_THAC", display: "Nơi nhận ủy thác" },
            { name: "NGAY_HIEU_LUC", display: "Ngày hiệu lực" },
        ],
    },
    {
        groupCode: "NHAN_UY_THAC_THA",
        groupName: "Thông báo nhận ủy thác",
        isDynamic: false,
        fields: [
            { name: "SO_THONG_BAO", display: "Số thông báo" },
            { name: "NGAY_THONG_BAO", display: "Ngày thông báo" },
            { name: "CO_QUAN_THONG_BAO", display: "Cơ quan ra thông báo" },
        ],
    },
    {
        groupCode: "BAO_CAO_DOI_CHIEU",
        groupName: "Báo cáo đối chiếu (Mẫu 7)",
        isDynamic: true,
        fields: [
            { name: "SO_PHAI_THU_CHU_DONG_N_TIEU_CHI", display: "Tiêu chí khoản thu N" },
            { name: "SO_PHAI_THU_CHU_DONG_N_TONG_SO_TIEN_PHAI_THI_HANH", display: "Tổng số tiền phải thi hành N" },
            { name: "SO_PHAI_THU_CHU_DONG_N_SO_TIEN_DA_GIAI_QUYET_THEO_BIEN_PHAP", display: "Biện pháp giải quyết N" },
            { name: "SO_PHAI_THU_CHU_DONG_N_SO_TIEN_DA_GIAI_QUYET", display: "Số tiền đã giải quyết N" },
            { name: "SO_PHAI_THU_CHU_DONG_N_SO_THUC_THU", display: "Số tiền thực thu N" },
            { name: "SO_PHAI_THU_CHU_DONG_N_SO_DA_NOP_NSNN_CHI_TRA", display: "Số tiền đã nộp NSNN/Chi trả N" },
            { name: "SO_PHAI_THU_CHU_DONG_N_NGAY", display: "Ngày thực hiện N" },
        ],
    },
];

export const ALL_GROUP_CODES: string[] = METADATA_SCHEMA.map((g) => g.groupCode);

/** Normalized schema keys used for field-level assignment validation, e.g. "NHAN_UY_THAC_THA.SO_THONG_BAO". */
export const ALL_METADATA_FIELD_KEYS: string[] = METADATA_SCHEMA.flatMap((group) =>
    group.fields.map((field) => `${group.groupCode}.${field.name}`)
);

export function getGroupFieldKeys(groupCode: string): string[] {
    const group = METADATA_SCHEMA.find((g) => g.groupCode === groupCode);
    return group?.fields.map((f) => `${groupCode}.${f.name}`) ?? [];
}

export function buildMetadataSchemaResponse() {
    return {
        groups: METADATA_SCHEMA.map((group) => ({
            groupCode: group.groupCode,
            groupName: group.groupName,
            isDynamic: group.isDynamic,
            fields: group.fields.map((field) => ({
                key: `${group.groupCode}.${field.name}`,
                name: field.name,
                display: field.display,
            })),
        })),
    };
}
