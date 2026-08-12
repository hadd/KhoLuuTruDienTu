/** Nội dung thuyết minh Phụ lục III — do người dùng soạn (gửi khi xuất, không lưu DB). */
export type Pl3Content = {
    creatingAgency: string;
    formationMission: string;
    collectionSource: string;
    timePeriod: string;
    expiryDuplicateReason: string;
    priorValuation: string;
    countsDetail: string;
    timeRangeText: string;
    expiredGroupSummary: string;
    duplicateGroupSummary: string;
    otherGroupSummary: string;
};

export const PL3_FORMATION_FIELD_LABELS: Readonly<Record<
    keyof Pick<
        Pl3Content,
        | "creatingAgency"
        | "formationMission"
        | "collectionSource"
        | "timePeriod"
        | "expiryDuplicateReason"
        | "priorValuation"
    >,
    string
>> = {
    creatingAgency: "Tài liệu này do cơ quan/bộ phận nào tạo ra?",
    formationMission: "Được hình thành trong quá trình thực hiện nhiệm vụ gì?",
    collectionSource: "Tài liệu được tập hợp thành khối từ đâu?",
    timePeriod: "Khoảng thời gian nào?",
    expiryDuplicateReason:
        "Vì sao hiện nay khối tài liệu được xác định là hết thời hạn lưu trữ hoặc trùng lặp?",
    priorValuation:
        "Khối tài liệu này đã được chỉnh lý, xác định giá trị như thế nào trước khi đưa ra hủy?",
};

export const PL3_REQUIRED_FORMATION_KEYS = [
    "creatingAgency",
    "formationMission",
    "collectionSource",
    "timePeriod",
    "expiryDuplicateReason",
    "priorValuation",
] as const satisfies readonly (keyof Pl3Content)[];

export type Pl3SuggestionsResponse = {
    fondName: string;
    content: Pl3Content;
};
