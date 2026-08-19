/**
 * Chuẩn hóa tên mục kho để so trùng:
 * bỏ hết khoảng trắng + lowercase — "kệ 1" và "kệ     1" được coi là trùng.
 */
export function normalizeItemNameForCompare(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase()
}
