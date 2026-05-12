# Scripts Directory - nextedu.ai Backend

This directory contains all utility scripts for database management and development tools.

## Directory Structure

```
scripts/
├── README.md
├── .gitignore
├── output/                     # Usage report output (gitignored at repo root)
│
├── migrations/                 # Database migrations
│   ├── README.md
│   ├── workflow.ts
│   ├── migrate.ts
│   ├── db-prepare.ts
│   ├── db-reset.ts
│   ├── create-schema.ts
│   ├── clean-migrations.ts
│   ├── check-migrations.ts
│   └── ...
│
├── seed/                       # Seeding and demo data
│   ├── index.ts
│   ├── data.ts
│   ├── utils.ts
│   └── ...
│
├── reporting/                  # Usage reports
│   ├── usage-report.ts
│   ├── usage-report-markdown.ts
│   └── usage-report-json-to-md.ts
│
├── s3/                         # S3 config verification
│   ├── verify-s3-config.ts
│   └── s3-config.sample.json
│
├── test/                       # Test DB and coverage
│   ├── test-coverage.ts
│   ├── test-db-reset.ts
│   └── test-db-setup.ts
│
├── db/                         # DB introspection
│   ├── check-all-schemas.ts
│   └── check-tables.ts
│
├── init/                       # School/bootstrap init
│   └── init-new-school.ts
│
├── one-time/                   # Numbered one-off scripts (see one-time/README.md)
│   ├── README.md
│   └── ...
│
├── custom/                     # Legacy one-off migrations and utilities
│   ├── create-users-from-list.ts
│   ├── users-example.json
│   └── 2025-01-28-migration-clone-outcomes-for-school.ts
│
└── cleanup/                    # Data cleanup scripts
    └── remove-school-admin-teacher-records.ts
```

## Quick Start

### Database Setup

```bash
# Run migrations
deno task db:migrate

# Reset database (DESTRUCTIVE)
deno task db:reset
```

## Documentation

### Database Management & Migrations

See **[migrations/README.md](./migrations/README.md)** for details. Always run **generate** from **packages/ai-edu-backend** with `deno task db:generate` (never `npx drizzle-kit generate` — config uses Deno env).

| Script | Command | Description |
|--------|---------|-------------|
| **drizzle-kit generate** | `deno task db:generate` | Generate migration from schema changes (Deno only; run from packages/ai-edu-backend) |
| **workflow.ts** | `deno task db:workflow` | Interactive migration workflow manager |
| **migrate.ts** | `deno task db:migrate` | Apply pending migrations |
| **db-prepare.ts** | `deno task db:prepare` | Prepare database (create schema + migrate) |
| **db-reset.ts** | `deno task db:reset` | Reset database (DESTRUCTIVE) |
| **clean-migrations.ts** | `deno task db:clean-migrations` | Clean migration tree for fresh start |
| **check-migrations.ts** | `deno task db:check-migrations` | Show applied migrations |

### Reporting

| Script | Command | Description |
|--------|---------|-------------|
| **usage-report.ts** | `deno run -A scripts/reporting/usage-report.ts` | Thống kê tình hình sử dụng (outcomes, question bank, assignments, upload, bài học, chấm điểm); không bao gồm email @nextedu.ai. Chạy từ `packages/ai-edu-backend` với `.env`. Tuỳ chọn: `SCHOOL_ID=<uuid>`. Kết quả: `scripts/output/usage-report-latest.json` và `.md`. |
| **usage-report-json-to-md.ts** | `deno run -A scripts/reporting/usage-report-json-to-md.ts [path-to-report.json]` | Chuyển file JSON báo cáo sang Markdown. Mặc định: `scripts/output/usage-report-latest.json`. |

Output báo cáo: `scripts/output/` (thư mục này được gitignore ở repo root).

### S3

| Script | Command | Description |
|--------|---------|-------------|
| **verify-s3-config.ts** | `deno run -A scripts/s3/verify-s3-config.ts [config-key] [--cleanup]` | Verify S3 config (testConnection, ensureBucketExists, upload, list, download, presigned URLs, delete, getConfig, isPrefixPublic). Config key: omit hoặc `env` = từ env; `<school-uuid>` = từ DB `school_config`; `file:./path.json` = từ file. Mẫu: `scripts/s3/s3-config.sample.json`. Chạy từ `packages/ai-edu-backend`. |

### Test

| Script | Command | Description |
|--------|---------|-------------|
| **test-coverage.ts** | `deno task test:coverage` | Chạy test với coverage; báo cáo lọc theo modules/, libs/, router/, db/. |
| **test-db-reset.ts** | `deno task test:db:reset` | Reset database test (drop schema và tạo lại). |
| **test-db-setup.ts** | `deno task test:db:setup` | Setup database test (migrate + seed nếu cần). |

### DB introspection

| Script | Command | Description |
|--------|---------|-------------|
| **check-all-schemas.ts** | `deno run -A scripts/db/check-all-schemas.ts` | Liệt kê tất cả schema và bảng (trừ pg_catalog, information_schema). |
| **check-tables.ts** | `deno run -A scripts/db/check-tables.ts` | Liệt kê bảng trong schema `ai_edu_app`. |

### Seeding

| Script | Command | Description |
|--------|---------|-------------|
| **seed/index.ts** | `deno task seed` hoặc `deno run -A ./scripts/seed/index.ts` | Full bootstrap demo data (schools, users, categories, ...). |
| **seed/backfill-category-metadata.ts** | `deno run -A ./scripts/seed/backfill-category-metadata.ts` | Backfill subject metadata (`{ color, icon }`) cho từng trường; env `SCHOOL_ID` để giới hạn. |

### Init

| Script | Command | Description |
|--------|---------|-------------|
| **init-new-school.ts** | `deno run -A scripts/init/init-new-school.ts` | Tạo trường mới và admin tương ứng (ví dụ Aurora International School). |

### One-time

Numbered one-off scripts: **`[one-time/README.md](./one-time/README.md)`** — naming (`NNN-slug`), single file vs folder, `_tmp` for generated output (gitignored), and how they differ from `custom/`. Chạy từ `packages/ai-edu-backend`; entry và lệnh mẫu nằm trong README đó.

### Custom

Legacy one-off migrations và tiện ích ad-hoc: `scripts/custom/`. Script **mới** nên dùng `one-time/` theo quy ước trong `one-time/README.md`. Ví dụ legacy: `create-users-from-list.ts`, `2025-01-28-migration-clone-outcomes-for-school.ts`. Chạy thủ công theo hướng dẫn trong từng file.

### Cleanup

| Script | Command | Description |
|--------|---------|-------------|
| **remove-school-admin-teacher-records.ts** | `deno run -A ./scripts/cleanup/remove-school-admin-teacher-records.ts` | Xóa bản ghi teacher cho user có role school_admin. |

## Related Documentation

- [Backend README](../README.md)
- [Database Documentation](../../../docs/res/database/overview.md)
- [Supabase Setup](../../../docs/SUPABASE_USER_GUIDE.md)
- [Testing Guide](../../../docs/res/testing/guide.md)
- [Full Documentation Index](../../../docs/res/README.md)

## Application Context

**Domain**: nextedu.ai  
**Purpose**: Educational platform for Vietnamese high schools  
**Tech Stack**: Deno, Drizzle ORM, Supabase Auth, PostgreSQL

---

**Last Updated**: April 2026
