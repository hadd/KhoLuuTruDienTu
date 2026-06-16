# AIP WORM Storage Setup

Archival Information Packages (AIP_hoso) are stored in a separate MinIO bucket with Object Lock enabled.

## Create WORM bucket (one-time)

```bash
mc mb --with-lock myminio/aip-secure-bucket
```

Replace `aip-secure-bucket` with your `STORAGE_AIP_BUCKET` value if different.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_AIP_BUCKET` | `aip-secure-bucket` | WORM bucket name |
| `STORAGE_AIP_PREFIX` | `aip` | Key prefix inside bucket |
| `STORAGE_AIP_RETENTION_YEARS` | `70` | Object Lock retention period |
| `STORAGE_AIP_OBJECT_LOCK_MODE` | `COMPLIANCE` | `COMPLIANCE` or `GOVERNANCE` |

## IAM policy

Grant the application **PutObject** and **GetObject** only. Do **not** grant **DeleteObject** on the AIP bucket.

## Object key layout

```
aip/{folderPath}/{ho_so_id}-AIP_hoso.zip
```

Ví dụ: dossier `folderPath = raw/2024/Q1/HS-001` → `aip/raw/2024/Q1/HS-001/HS-001-AIP_hoso.zip`

(`folderPath` trùng cấu trúc thư mục raw trên data-lake, không lặp thêm segment hồ sơ.)

Status is determined by `statObject` on this key — no database columns required.
