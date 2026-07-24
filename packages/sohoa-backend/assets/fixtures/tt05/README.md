# TT05 fake metadata fixtures

Các file JSON fake theo mẫu `assets/TT05.json`, mirror cấu trúc storage:

```
processed/<project>/<ho_so_id>/<ho_so_id>.json
```

Ví dụ: `processed/TESST3/296_CD/296_CD.json` tương ứng hồ sơ `raw/TESST3/296_CD/`.

## Tạo / cập nhật fixture

```bash
cd packages/sohoa-backend

# Ghi file local + upload S3 + cập nhật DB (hồ sơ có sẵn)
deno task seed:tt05-fake -- --ho-so-id 296_CD --upload --sync-db

# Chỉ ghi file local (không cần S3)
deno task seed:tt05-fake -- --folder-path raw/TESST3/TT05_DEMO --ho-so-id TT05_DEMO

# Upload lên S3 processed/ (dùng file vừa generate)
deno task seed:tt05-fake -- --ho-so-id 296_CD --upload --sync-db --no-write-local
```

Sau khi upload, reload hồ sơ trong **Quản lý dữ liệu** → tab **Metadata**.
