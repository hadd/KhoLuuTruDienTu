---
name: review-latest-3-commits
description: Reviews the latest 3 commits (HEAD~2..HEAD) against project rules, logic, performance, and security; outputs BLOCK or APPROVE with rationale and fix checklist. Use when the user asks to check code update gần đây, check recent code updates, review code mới nhất, or kiểm tra code gần đây.
---

# Review Latest 3 Commits

Reviews only committed code in the last 3 commits. Ignores unstaged and staged working tree changes. Read-only: reports findings and decision; does not modify code or auto-fix.

## Quick Workflow

1. **Determine scope**: Inspect exactly the latest 3 commits (`HEAD~2..HEAD`). If the repo has fewer than 3 commits, review all available commits and state that explicitly (e.g. "Reviewed 2 commits; only 2 exist.").
2. **Gather context**: Run `git log --oneline -n 3` and, for each commit in range, `git show <commit> --stat` and `git show <commit>` (or `git diff HEAD~3..HEAD` for combined diff). Do not use `git diff` or `git diff --staged` (working tree).
3. **Run review checklist**: Apply the four categories below to the diff of those commits only.
4. **Report findings**: For each finding, include severity, commit ref (hash or subject), file path, and actionable suggestion.
5. **Output decision**: End with **BLOCK** or **APPROVE**, rationale, and either a fix checklist (if BLOCK) or residual-risk note (if APPROVE).

## Severity Levels

- **CRITICAL** — Must fix (security, broken logic, NEVER-rule violations). Any critical → **BLOCK**.
- **WARNING** — Should fix (missing i18n, type safety, performance). Warnings alone → **APPROVE** with follow-up checklist.
- **INFO** — Consider improving (style, optional optimizations).

---

## Category 1: Project Rules Compliance

Use [validation-checks.mdc](.cursor/rules/validation-checks.mdc) and [core.mdc](.cursor/rules/core.mdc). Apply only to changed lines in the commit range.

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

**Findings** — For each finding:

```
**Severity**: CRITICAL | WARNING | INFO
**Commit**: <short-hash or subject>
**File**: path/to/file.tsx (optional line or hunk)
**Issue**: One-line description.
**Suggestion**: What to do (specific fix or rule to follow).
```

**Decision** — Always end with:

```
---
## Decision
**BLOCK** | **APPROVE**
**Rationale**: One or two sentences (why block or why approve; mention critical count if blocking).

(If BLOCK:)
## Fix checklist
- [ ] Fix 1 (brief)
- [ ] Fix 2 (brief)

(If APPROVE:)
## Residual risk / follow-up
- Optional note on warnings or low-risk items to address later.
```

**Counts** — Before the decision, include:

```
- Critical: N
- Warning: N
- Info: N
```

---

## Example Output (excerpt)

**Severity**: WARNING  
**Commit**: a1b2c3d feat(students): add list filters  
**File**: src/features/students/components/StudentList.tsx  
**Issue**: Hardcoded button label "Add student".  
**Suggestion**: Add key to en/vi JSON and use `t('students.addStudent')`.

**Severity**: CRITICAL  
**Commit**: e4f5g6h fix(api): use axios for courses  
**File**: src/features/courses/api/courseClient.ts  
**Issue**: Direct `axios.get(...)` used.  
**Suggestion**: Use `apiClient` from `@/lib/api/apiClient`; see core.mdc.

---

- Critical: 1
- Warning: 1
- Info: 0

## Decision

**BLOCK**  
**Rationale**: One critical finding (direct axios usage); must fix before merge.

## Fix checklist

- [ ] Replace axios with apiClient in courseClient.ts (commit e4f5g6h).
- [ ] Replace hardcoded "Add student" with t('students.addStudent') in StudentList.tsx (commit a1b2c3d).

---

## Edge Cases and Guardrails

- **Fewer than 3 commits**: Review all existing commits (e.g. `HEAD~1..HEAD` or single commit). State at the start: "Reviewed N commit(s); repo has fewer than 3."
- **No findings**: Still output decision: **APPROVE** with rationale (e.g. "No critical or warning findings in the reviewed commits") and optional residual-risk note (e.g. "None identified.").
- **Read-only**: This skill only reports. Do not edit files, run fix commands, or auto-apply changes. The user decides what to fix; they may then run review-code (for working tree) or commit-code as needed.
