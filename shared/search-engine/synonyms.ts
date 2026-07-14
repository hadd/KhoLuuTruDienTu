/**
 * Synonym tĩnh domain THADS (MVP).
 * Chỉ dùng ở search_analyzer — sau icu_folding + lowercase nên viết dạng đã bỏ dấu.
 *
 * Solr synonym format: "a, b, c" = tương đương lẫn nhau.
 */
export const VI_LEGAL_SYNONYMS: string[] = [
  "toa an nhan dan, tand",
  "thi hanh an, tha",
  "cuc thi hanh an dan su, cthads",
  "quyet dinh, qd",
];
