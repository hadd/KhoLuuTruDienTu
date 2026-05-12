---
name: review-code
description: Reviews changed code before commit for logic, performance, security, and maintainability; applies AI-Edu workspace conventions. Use when the user asks to review code, review before commit, check my changes, or pre-commit review.
---

# Review Code Before Commit (AI-Edu)

## Workflow

1. **Gather changes**: Run `git status`, `git diff`, and `git diff --staged` to get all changed code.
2. **Identify changed files**: List paths and briefly categorize (e.g. by layer or concern).
3. **Run checklist**: Apply the behavior-based categories below and the AI-Edu workspace rules to the diff only.
4. **Report findings**: Output each finding with severity, file/location, and actionable suggestion (see Report format).
5. **Summarize**: Give a verdict — **PASS** (0 critical, 0 warning), **CONDITIONAL PASS** (0 critical, has warnings), or **FAIL** (has critical). Do not auto-fix; only report.

## Severity levels

- **CRITICAL** — Must fix before commit (security, broken logic, data integrity).
- **WARNING** — Should fix (correctness risks, performance issues, maintainability).
- **INFO** — Consider improving (style, clarity, optional optimizations).

---

## Checklist by behavior (stack-agnostic)

Apply only to changed lines.

### Logic and bugs

- Null/undefined: optional chaining or guards before property access where needed.
- Edge cases: off-by-one, empty collections, boundary conditions.
- Async: race conditions, missing error handling or cleanup where relevant.
- Control flow: correct branching and loop termination.

### Performance

- Unnecessary work in hot paths or on every render/request.
- Heavy imports or redundant queries/requests in the changed code.
- Obvious N+1 or duplicated work in the diff.

### Security

- User input: validated or sanitized before use or before sending to backend/storage.
- No secrets, API keys, or sensitive config in the diff.
- No dangerous eval or equivalent with user-controlled input; no raw innerHTML (or equivalent) with unsanitized user content.
- No obviously exposed internal paths or tokens in client-visible code.

### Maintainability

- Naming: clear and consistent with the rest of the codebase.
- File/layout: changes fit existing structure; no unnecessary fragmentation.

---

## AI-Edu / workspace rules

When reviewing, apply these workspace conventions. **If general guidance conflicts with workspace rules, prefer AI-Edu rules.** Reference: [.cursor/rules/rule-index.mdc](.cursor/rules/rule-index.mdc).

- **Backend / shared**: [.cursor/rules/backend-style.mdc](.cursor/rules/backend-style.mdc), [docs/res/code-style/guide.md](docs/res/code-style/guide.md) — Services extend `createCrudService`; routers are factory functions returning Elysia with `internalFilter`/`internalFilterQuery` for multi-tenant scoping; module layout: service, `*.admin-router.ts`, `*.school-router.ts`, types, index; use shared libs from `shared/`; category fields use string keys.
- **Category**: [.cursor/rules/category-system.mdc](.cursor/rules/category-system.mdc) — `grade`, `subject`, `level` are string keys (e.g. `"lop-10"`, `"toan"`, `"easy"`); never use `gradeId`, `subjectId`, `levelCategoryId`; validate with `gradeKeySchema`, `subjectKeySchema`, `levelKeySchema` from `db/schemas/category-constants.ts`.
- **Code style**: [.cursor/rules/code-files.mdc](.cursor/rules/code-files.mdc) — Lean comments; import order: std → third-party → `@shared/*` → local; app logic in `packages/`, base logic in `shared/`.
- **Tests**: [.cursor/rules/test-files.mdc](.cursor/rules/test-files.mdc), [docs/res/testing/guide.md](docs/res/testing/guide.md) — `Deno.test.beforeAll` for setup; `t.step()` for scenarios; descriptive test/step names; `NODE_ENV=test` when running tests; Given-When-Then structure.
- **Auth / routing** (when diff touches routers or auth): [.cursor/rules/auth-routing.mdc](.cursor/rules/auth-routing.mdc) — Auth plugin and school-scoped routing; role checks; ID validation; multi-tenant scoping.

---

## Report format

For each finding:

```
**Severity**: CRITICAL | WARNING | INFO
**File**: path/to/file (optional line or hunk)
**Issue**: One-line description.
**Suggestion**: What to do (specific fix or behavior to follow).
```

Then:

```
---
## Summary
- Critical: N
- Warning: N
- Info: N
**Verdict**: PASS | CONDITIONAL PASS | FAIL
```

---

## Notes

- Review only the diff (staged + unstaged). Do not report on unchanged files.
- If there are no changes, say so and skip the checklist.
- This skill does not modify code; it only reports. The user decides what to fix.
