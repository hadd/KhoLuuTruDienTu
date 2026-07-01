---
trigger: model_decision
description: Index of all rule files for discoverability and reference
globs:
---

# Rules Index

This file provides an overview of all rule files in `.cursor/rules/` and when they are applied.

## Always Loaded (Core Rules)

### `core.mdc`

**Always applies** - Essential development principles, tech stack, naming conventions, and architecture rules. Contains all core patterns that apply to every code change.

### `validation-checks.mdc`

**Always applies** - Pre-completion validation checklist for AI agents. Small file, critical for quality assurance.

### `workflow.mdc`

**Always applies** - Development workflow guidelines, AI persona, code generation guidelines, and **planning requirements** (folder tree structure for affected files).

## Context-Aware Rules (Load via Globs)

These rules automatically load when working on relevant files:

### `api-guide.mdc`

**Applies when:** Working on API client files or queries

- `src/features/**/api/**Client.ts`
- `src/features/**/queries.ts`

**Content:** API client conventions, query parameters, filter serialization, response unwrapping patterns.

### `reusable-patterns.mdc`

**Applies when:** Working on API clients, forms, or Sheet components

- `src/features/**/api/**Client.ts`
- `src/features/**/components/**/*Form.tsx`
- `src/features/**/components/**/*Sheet.tsx`

**Content:** Reusable utilities and components (serializeFilter, getFieldError, RequiredMark, EntitySheet). Prevents code duplication.

### `crud-guide.mdc`

**Applies when:** Working on CRUD forms, sheets, or dialogs

- `src/features/**/components/**/*Sheet.tsx`
- `src/features/**/components/**/*Dialog.tsx`
- `src/features/**/components/**/*Form.tsx`

**Content:** CRUD implementation patterns, form state management, loading states, mutation handling.

### `table-guide.mdc`

**Applies when:** Working on tables, data grids, or column definitions

- `src/components/common/data-table/**/*`
- `src/features/**/components/*Table.tsx`
- `src/features/**/components/*List.tsx`
- `src/features/**/components/*columns.tsx`

**Content:** Table development rules, column formatting, pagination, URL-driven state.

### `routing.mdc`

**Applies when:** Working on route files

- `src/app/routes/**/*.tsx`

**Content:** TanStack Router patterns, nested routes, URL state preservation, layout decisions.

### `i18n.mdc`

**Applies when:** Working on components or i18n configuration

- `src/lib/i18n/**/*`
- `src/locales/**/*`
- `src/**/*.tsx`

**Content:** Internationalization rules, multi-namespace setup, translation key management.

### `data-and-forms.mdc`

**Applies when:** Working on schemas or forms

- `src/features/**/schemas.ts`
- `src/features/**/components/**/*Form.tsx`

**Content:** Zod schemas, form validation, type inference, API patterns. References `api-guide.mdc` for detailed API response patterns and `reusable-patterns.mdc` for form validation utilities.

### `components.mdc`

**Applies when:** Working on component files

- `src/components/**/*.tsx`
- `src/features/**/components/**/*.tsx`

**Content:** Component architecture, abstraction rules, composition patterns.

### `ui-components.mdc`

**Applies when:** Working on reusable UI components

- `src/components/common/**/*.tsx`
- `src/components/ui/**/*.tsx`

**Content:** Reusable UI component patterns and best practices. Documents `StatusBadge`, `Card` variants, `SearchSelect`, `DataTableRowActions`, and `TextBlock` components.

### `ui-patterns.mdc`

**Applies when:** Working on components or layouts

- `src/components/**/*.tsx`
- `src/features/**/components/**/*.tsx`
- `src/components/layouts/**/*.tsx`

**Content:** UI patterns, layout rules, interaction guidelines, detail page patterns. References `EntitySheet` and `StatusBadge` components (see `ui-components.mdc` and `reusable-patterns.mdc` for details).

### `error-handling.mdc`

**Applies when:** Working on routes or error components

- `src/app/routes/**/*.tsx`
- `src/**/*errorComponent*.tsx`

**Content:** Layered error handling strategy, error boundaries, error components.

## Feature-Specific Rules

### `question-studio-guide.mdc`

**Applies when:** Working on Question Studio feature

- `src/features/question-studio/**/*`

**Content:** Question Studio architecture, workspace-based UI patterns, feature-specific constraints.

### `breadcrumbs.mdc`

**Applies when:** Working on routes or breadcrumb component

- `src/app/routes/**/*.tsx`
- `src/components/common/AppBreadcrumb.tsx`

**Content:** Breadcrumb implementation patterns, staticData configuration.

## How Rules Are Loaded

1. **Always loaded:** `core.mdc` and `validation-checks.mdc` are included in every conversation.
2. **Context-aware:** Other rules are automatically loaded when you open or edit files matching their glob patterns.
3. **Manual reference:** You can reference this index to understand which rules apply to your current work.

## Rule Dependencies

Some rules reference others:

- `crud-guide.mdc` references `api-guide.mdc` for API client patterns
- `data-and-forms.mdc` references `api-guide.mdc` for API response patterns and `reusable-patterns.mdc` for form validation utilities
- `ui-patterns.mdc` references `ui-components.mdc` for `StatusBadge` and `reusable-patterns.mdc` for `EntitySheet`
- `reusable-patterns.mdc` documents utilities used by `api-guide.mdc` and `crud-guide.mdc`
- `core.mdc` contains the foundational patterns referenced by all other rules

## Token Optimization

This intelligent loading system reduces token consumption by:

- **60-80% reduction** when working on specific features
- Only loading relevant rules based on file context
- Keeping core rules small and essential (~8-10KB always loaded)
