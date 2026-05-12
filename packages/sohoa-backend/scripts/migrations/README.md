# Database Migrations Scripts

This directory contains all database migration-related scripts for the AI-Edu backend.

## 📁 Scripts Overview

### Core Migration Scripts

#### `migrate.ts`
Applies pending migrations to the database.
```bash
deno task db:migrate
```
- Runs all unapplied migrations from `db/drizzle/`
- Uses the Drizzle ORM migrator
- Safe to run multiple times (only applies new migrations)

#### `db-prepare.ts`
Prepares the database by creating the schema and applying migrations.
```bash
deno task db:prepare
deno task db:prepare:test  # For test environment
```
- Creates the schema if it doesn't exist
- Runs all pending migrations
- Ideal for initial setup or CI/CD pipelines

#### `db-reset.ts`
⚠️ **DESTRUCTIVE**: Drops and recreates the entire schema.
```bash
deno task db:reset
```
- Drops the configured schema (CASCADE)
- Recreates an empty schema
- **WARNING**: Deletes ALL data!
- Useful for development/testing when you want a clean slate

### Migration Management Scripts

#### `clean-migrations.ts`
Cleans the migration tree and resets to a fresh state.
```bash
deno task db:clean-migrations
```
- Removes all SQL migration files
- Removes all snapshot JSON files
- Resets the migration journal
- After running, you need to:
  1. Generate fresh migration: `deno task db:generate`
  2. Reset database: `deno task db:reset`
  3. Apply migration: `deno task db:migrate`

#### `check-migrations.ts`
Shows all applied migrations in the database.
```bash
deno task db:check-migrations
```
- Displays migration history
- Shows creation timestamps
- Useful for debugging migration issues

### Setup Scripts

## 🔄 Common Workflows

### 1. Initial Database Setup
```bash
# From packages/ai-edu-backend directory
deno task db:prepare            # Create schema and run migrations
deno task db:migrate              # Run migrations
```

### 2. Create a New Migration
Run all commands from **packages/ai-edu-backend**. Use **deno task db:generate** only (do not use `npx drizzle-kit generate` — the config uses Deno env and Node will throw "Deno is not defined").
```bash
# 1. Modify your schema files in db/schemas/
# 2. Generate migration (Deno only)
deno task db:generate

# 3. Review the generated SQL in db/drizzle/
# 4. Apply the migration when ready
deno task db:migrate
```

### 3. Reset Database (Development)
```bash
deno task db:reset              # Drop and recreate schema
deno task db:migrate            # Apply all migrations
deno task db:migrate              # Run migrations
```

### 4. Clean Migration History
```bash
# When you have too many incremental migrations
deno task db:clean-migrations   # Clean old migrations
deno task db:generate           # Generate fresh consolidated migration
deno task db:reset              # Reset database
deno task db:migrate            # Apply fresh migration
```

### 5. Check Migration Status
```bash
deno task db:check-migrations   # Show applied migrations
```

## 🏗️ Migration File Structure

```
db/
├── drizzle/                    # Migration files (generated)
│   ├── 0000_xxx.sql           # Migration SQL files
│   ├── 0001_yyy.sql
│   └── meta/
│       ├── _journal.json      # Migration journal
│       ├── 0000_snapshot.json # Schema snapshots
│       └── 0001_snapshot.json
├── migrations/                 # Custom SQL migrations
└── schemas/                    # Drizzle schema definitions
    ├── user.ts
    ├── school.ts
    └── ...
```

## ⚙️ Environment Variables

All scripts use the following environment variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=postgres
DB_SCHEMA=ai_edu_app
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
```

For testing, set `NODE_ENV=test` to use test-specific configuration.

## 🔒 Best Practices

### Development
- ✅ Run migrations frequently to catch issues early
- ✅ Review generated SQL before applying
- ✅ Use `db:reset` freely in local development
- ✅ Test migrations with sample data

### Production
- ⚠️ **NEVER** use `db:reset` in production
- ✅ Always backup before running migrations
- ✅ Test migrations in staging first
- ✅ Review migration SQL carefully
- ✅ Have a rollback plan
- ✅ Run migrations during maintenance windows

### Migration Files
- ✅ Generate migrations with `deno task db:generate`; do not add `.sql` files under `db/drizzle/` by hand (they will not run — the migrator uses `meta/_journal.json`).
- ✅ Keep migrations small and focused
- ✅ Never edit applied migrations
- ✅ Use descriptive names
- ✅ Add comments for complex changes
- ⚠️ Be careful with data migrations
- ⚠️ Consider backwards compatibility

## 🚨 Troubleshooting

### "Deno is not defined" when generating migrations
You ran `npx drizzle-kit generate` (Node). The project config imports `env.ts`, which uses `Deno.env`. Run generation with Deno from **packages/ai-edu-backend**: `deno task db:generate`. Do not use `npx drizzle-kit generate`.

### "Schema does not exist"
```bash
deno task db:prepare
```

### "Migration already applied"
This is normal - Drizzle tracks applied migrations. The migration will be skipped.

### Reset Everything
```bash
deno task db:reset
deno task db:migrate
```

### Clean Slate (Fresh Migration)
```bash
deno task db:clean-migrations
deno task db:generate
deno task db:reset
deno task db:migrate
```

## 📝 Notes

- All scripts support both development and test environments
- Use `NODE_ENV=test` for test database operations
- Migration scripts are idempotent where possible
- Check script output for errors and warnings
- Backup your data before destructive operations

## 🔗 Related Documentation

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Schema Documentation](../../db/schemas/README.md)

