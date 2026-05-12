# @shared/base-repo

Spec-driven repository: parse (spec) → build (Drizzle query) → execute (repo). Supports list, get, create, update, delete with optional filters, relations, transactions, and soft-delete handling.

- **Parse**: URL/object → `ListQuery` (filter, sort, search, pagination)
- **Build**: `ListQuery` + context → `DrizzleListQuery` (Drizzle SQL types)
- **Repo**: `createBaseRepo(config, customMethods?)` returns a base repo (list, page, parseQuery, findById, getOne, create, update, delete) plus any custom methods. Use `appliedForOnlyMatchedQuery`, `where`, `transaction`, `actor`, `includedSoftDelete` via options.

## Usage

```ts
import { createBaseRepo } from "@shared/base-repo";
import { isNull } from "drizzle-orm";
import { db } from "./db.ts";
import { schools } from "./schemas/school.ts";

export const repo = createBaseRepo({
  db,
  table: schools,
  searchable: ["name", "email"],
  appliedForOnlyMatchedQuery: () => isNull(schools.deletedAt),
});

// With custom methods
export const repo2 = createBaseRepo(config, { findBySlug: (slug: string) => /* ... */ });
```

## Options

- **list / page**: `list(query, options?)`, `page(query, options?)` — `options`: `includedSoftDelete?`, `transaction?`
- **findById / getOne**: `options`: `with?`, `includedSoftDelete?`, `transaction?`
- **create / update / delete**: `options`: `with?` (create/update), `where?` (update/delete), `actor?`, `includedSoftDelete?`, `transaction?`; `forceDelete?` (delete only)

Soft-deleted rows are excluded by default; pass `includedSoftDelete: true` to include them.
