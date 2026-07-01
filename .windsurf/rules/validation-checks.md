---
trigger: always_on
description: Pre-completion validation checklist for AI agents
globs:
---

# Validation Checklist

Before marking a task as complete, AI MUST verify:

## i18n Validation

- [ ] **No hardcoded UI strings**: Search component for patterns `["'][A-Z][a-z]{3,}.*["']` (exclude technical identifiers, symbols, code)
- [ ] **All translation keys exist**: All used keys must exist in both `en` and `vi` JSON files
- [ ] **Namespace imported**: Component imports `useTranslation('namespace')` with correct namespace
- [ ] **Placeholder text**: Form placeholders use `t('xxx.placeholder')`, not hardcoded strings
- [ ] **Status labels**: Status badges use `t('xxx.status.active')`, not `"Active"`
- [ ] **Button text**: All buttons use `t('xxx.action')`, not hardcoded text
- [ ] **Error messages**: Zod validation errors are automatically translated via locale system. Only fallback messages need `t('xxx.errors.invalidValue')`. Display errors inline below inputs.

## Type Safety

- [ ] **Entity types**: For read operations, types imported from `@/types/common` (not manual interfaces)
- [ ] **Zod schemas**: Forms use Zod schemas with `z.infer<typeof Schema>` (not manual interfaces)
- [ ] **No `any` types**: All types are explicitly defined, no `any` or `unknown` without proper handling

## Patterns Compliance

- [ ] **API calls**: No direct `axios` or `fetch` calls - use `apiClient` from `@/lib/api/apiClient`
- [ ] **Semantic tokens**: Structural UI uses semantic tokens (`bg-primary`, `text-muted-foreground`), not utility colors
- [ ] **Form patterns**: Forms use TanStack Form + Zod validation (not react-hook-form or raw state)
- [ ] **URL state**: Filters, tabs, pagination use URL search params (TanStack Router), not `useState`

## Code Quality

- [ ] **Component naming**: Component names match filename (PascalCase, e.g., `StudentForm.tsx` → `StudentForm`)
- [ ] **Rule of Three**: No premature abstraction - only move to `common/` after 3+ uses
- [ ] **Error boundaries**: Routes implement `errorComponent` for error handling
- [ ] **File structure**: Follow feature-based structure - colocate related files in `features/{feature}/`

## Self-Reporting

When completing a task, AI should report:

- "✅ i18n: All strings use translation keys"
- "✅ Types: Entity types from @/types/common, Zod schemas for forms"
- "✅ Patterns: Using apiClient, semantic tokens, TanStack Form, URL state"
- "✅ Quality: Naming consistent, no premature abstraction, error boundaries implemented"

---

**Key Principle**: Self-validate before completion. Report validation results in completion message.
