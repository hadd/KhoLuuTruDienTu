/**
 * Ed25519 public key (raw, base64) — app verify file .lic bằng key này.
 *
 * Cách lấy:
 *   1. deno task page-license:gen-keys -- --out-dir=./secrets
 *   2. Mở secrets/page-quota-ed25519.pub → copy chuỗi base64
 *   3. Dán vào hằng dưới đây (thay REPLACE_WITH_GEN_KEYS_OUTPUT)
 *
 * Private key (.pem) giữ ở máy công ty, KHÔNG đưa vào tar khách.
 * Override tạm: env PAGE_QUOTA_PUBLIC_KEY
 *
 * Xem thêm: scripts/PAGE_LICENSE.md
 */
export const EMBEDDED_PAGE_QUOTA_PUBLIC_KEY_B64 =
    "jmrAFEu4+EO3Cqzia87Am8wsAb8li5fEh9UeXhpP8g8=";
