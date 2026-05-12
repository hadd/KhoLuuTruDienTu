# AI-Edu Backend

Backend service for AI-Edu school management system built with Deno, Elysia, and PostgreSQL.

## Quick Start

```bash
# Manual setup
cd packages/ai-edu-backend
deno task db:migrate    # Run migrations
deno task dev           # Start development server
```

## Documentation

- 📖 **[Main Documentation](./docs/README.md)** - Start here
- 🗄️ **[Database Guide](../../docs/res/database/overview.md)** - Schema, migrations, Snowflake IDs
- 🧪 **[Testing Guide](../../docs/res/testing/guide.md)** - Running and writing tests
- 📋 **[Full Documentation Index](../../docs/res/README.md)** - Complete documentation structure

## Features

- ✅ Multi-tenant school management
- ✅ Snowflake IDs (time-ordered, auto-generated)
- ✅ Role-based access control
- ✅ Course management system
- ✅ Student submissions & grading
- ✅ Attendance tracking
- ✅ Multi-provider authentication

## Tech Stack

- **Runtime**: Deno 2.x
- **Framework**: Elysia
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Supabase Auth
- **Testing**: Deno Test

## Environment Setup

Create `.env`:

```bash
DB_HOST=localhost
DB_PORT=5432`
DB_NAME=ai_edu
DB_USER=postgres
DB_PASSWORD=postgres
DB_SCHEMA=ai_edu_app
````

## Available Commands

### Development

```bash
deno task dev              # Development server
deno task start            # Production server
```

### Database

```bash
deno task db:generate      # Generate migration
deno task db:migrate       # Run migrations
deno task db:prepare       # Prepare database
deno task db:push          # Push schema changes
```


### Testing

```bash
deno task test             # Run all tests
deno task test:e2e         # E2E tests only
deno task test:watch       # Watch mode
deno task test:setup       # Setup test environment
```

## Project Structure

```text
packages/ai-edu-backend/
├── docs/              # 📖 Documentation
├── db/                # Database schemas & migrations
├── modules/           # Feature modules
├── libs/              # Shared utilities
├── scripts/           # Setup & utility scripts
└── test/              # Test suites
```

## Getting Started

See [docs/README.md](./docs/README.md) for detailed documentation.
