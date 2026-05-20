---
name: review-code
description: Reviews changed code before commit against project rules, logic/bugs, performance, and security. Use when the user asks to review code, review before commit, check my changes, or pre-commit review.
---

# Review Code Before Commit

## Quick Workflow

1. **Gather changes**: Run `git status`, `git diff`, and `git diff --staged` to get all changed code.
2. **Identify changed files**: List paths and categorize (component, route, api, schema, i18n, etc.).
3. **Run review checklist**: Apply all four categories below to the diff only.
4. **Report findings**: Output each finding with severity, file/location, and actionable suggestion.
5. **Summarize**: Give a verdict — **PASS** (0 critical, 0 warning), **CONDITIONAL PASS** (0 critical, has warnings), or **FAIL** (has critical). Do not auto-fix; only report.

## Severity Levels

- **CRITICAL** — Must fix before commit (security, broken logic, NEVER-rule violations).
- **WARNING** — Should fix (missing i18n, type safety, performance issues).
- **INFO** — Consider improving (style, optional optimizations).

---

## Category 1: Project Rules Compliance

Use [validation-checks.mdc](.cursor/rules/validation-checks.mdc) and [core.mdc](.cursor/rules/core.mdc). Apply only to changed lines.

**i18n**

- No hardcoded UI strings; use `t('key')` and correct namespace.
- All used keys exist in both `en` and `vi` JSON for the namespace.
- Placeholders, buttons, status labels use translation keys.

**Type safety**

- Read operations: types from `@/types/common` or `@/features/{domain}/types`.
- Forms: Zod schemas with `z.infer<typeof Schema>`.
- No `any`; no `unknown` without proper handling.

**Patterns**

- API: `apiClient` from `@/lib/api/apiClient` only; no direct `fetch`/`axios`.
- Styling: semantic tokens (`bg-primary`, `text-muted-foreground`, `border-border`); use `cn()` for merging.
- Forms: TanStack Form + Zod; no react-hook-form.
- URL state: filters, tabs, pagination via TanStack Router search params; no `useState` for these.
- Data fetching: `useQuery` + `queryOptions` from feature `queries.ts`; no `useEffect` for fetching.

**Negative constraints (NEVER)**

- No `useState` for server state or URL-driven state.
- No FontAwesome/Heroicons; only `lucide-react`.
- No `import.meta.env`; use `env` from `@/lib/utils/env`.
- Status: use `StatusBadge`; cards: use `Card` with variants; selects: use `SearchSelect` or factory helpers.
- Routes: `errorComponent` for major routes.

**Naming & structure**

- Components: PascalCase, match filename; files in `features/{feature}/`.
- No premature abstraction to `common/` before 3+ uses.

---

## Category 2: Logic and Bugs

- Null/undefined: optional chaining, guards before property access.
- Error boundaries: major routes have error handling.
- Async: no obvious race conditions; cleanup in effects if needed.
- Conditionals: correct branching; watch for off-by-one in loops/pagination.
- Data fetching: loading and error states present where relevant.

---

## Category 3: Performance

- Re-renders: unnecessary work in render or missing memoization for expensive children/callbacks where it matters.
- Imports: avoid pulling entire libraries; prefer named imports.
- Queries: use `queryOptions` factory; avoid N+1 or redundant requests in changed code.

---

## Category 4: Security

- No `dangerouslySetInnerHTML` with unsanitized user input.
- No secrets, API keys, or sensitive config in the diff.
- User input validated (Zod/schemas) before use or send.
- No obviously exposed internal paths or tokens in client code.

---

## Report Format

For each finding:

```
**Severity**: CRITICAL | WARNING | INFO
**File**: path/to/file.tsx (optional line or hunk)
**Issue**: One-line description.
**Suggestion**: What to do (specific fix or rule to follow).
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

## Example Output (excerpt)

**Severity**: WARNING  
**File**: src/features/students/components/StudentList.tsx  
**Issue**: Hardcoded button label "Add student".  
**Suggestion**: Add key to en/vi JSON and use `t('students.addStudent')`.

**Severity**: CRITICAL  
**File**: src/features/courses/api/courseClient.ts  
**Issue**: Direct `axios.get(...)` used.  
**Suggestion**: Use `apiClient` from `@/lib/api/apiClient`; see core.mdc.

---

**Summary**

- Critical: 1
- Warning: 1
- Info: 0  
  **Verdict**: FAIL

---

## Notes

- Review only the diff (staged + unstaged). Do not report on unchanged files.
- If there are no changes, say so and skip the checklist.
- This skill does not modify code; it only reports. The user decides what to fix before running the commit-code skill.
