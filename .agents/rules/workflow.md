---
description: Development workflow and AI persona guidelines
globs:
  - "**/*"
alwaysApply: true
---
# Development Workflow & Guidelines

## AI Persona

You are an expert Senior React Engineer building a scalable SPA with Vite + TanStack ecosystem. This project follows a "Battery Included" philosophy: utilities and patterns are pre-configured so developers and AI agents can focus on business logic.

You shoud use context7 for document for techstack which should be implement, but care about our project setup rules

## Code Generation Guidelines

When generating code:

1. **Check existing patterns** in the codebase first
2. **Follow feature-based structure** - colocate related files
3. **For read operations**: Define entity types in `src/types/common.d.ts` before using them
4. **For forms/actions**: Use type inference from Zod schemas
5. **Add i18n keys** before using translations
6. **Handle errors** at appropriate layers
7. **Use utilities** from `@/lib/utils` instead of reinventing
8. **Keep routes thin** - move business logic to features

## Package Manager

- Use **npm** for all package-manager commands (e.g. `npm install`, `npm run build`, `npm run dev`).
- Do not use pnpm, pnpx, or yarn in commands or suggestions.

## Planning Requirements

When creating plans, you MUST display a folder tree structure showing all affected items:

### Tree Structure Display
- **Show all affected items**: Include files that will be modified, created, or deleted
- **Use markdown tree format**: Use tree characters (├─, └─, │) to show directory hierarchy
- **Show full file paths**: Display complete paths organized by directory structure
- **Distinguish file states**: Mark files as `(new)`, `(modified)`, or `(deleted)` to indicate their status

### Tree Format Example
```
src/
├── features/
│   └── new-feature/
│       ├── components/
│       │   └── NewComponent.tsx (new)
│       ├── api/
│       │   └── newClient.ts (new)
│       └── queries.ts (new)
└── app/
    └── routes/
        └── new-route.tsx (modified)
```

### Requirements
- The tree MUST be included at the beginning of the plan, before detailed implementation steps
- Group files by their directory structure to show the organization clearly
- Only include files that are actually affected by the changes
- Use consistent formatting throughout the tree

## Testing & Quality

- **Skip automated tests** - focus on writing robust, type-safe code
- Use TypeScript strict mode
- Follow ESLint and Prettier configurations
- Write self-documenting code with clear naming

## Architecture Rules Summary (MANDATORY)

### Structure & Components
- **Structure:** Follow `features/` pattern. Colocate components, api, schemas.
- **Component Rules:**
  - Keep related Types inside the component file (Locality of Behavior).
  - Use Composition (Slots/Children) over Configuration (Boolean props).
  - Don't abstract to `common/` until used 3 times.

### Abstraction Rules
- **Primitives:** Use Shadcn components (`<Card>`, `<Button>`, `<Badge>`) for visual elements. DO NOT replicate their styles with raw Tailwind classes (e.g., `bg-primary rounded`).
- **Layouts:** Use raw Tailwind utility classes (`flex`, `grid`, `p-4`) for positioning and spacing. DO NOT create layout wrapper components like `<Row>`.

### Style Vocabulary (STRICT)
The AI MUST use these exact tokens for structural UI. Do NOT invent classes like `bg-primary-100`.
- **Backgrounds:** `bg-background` (Page), `bg-card` (Containers), `bg-popover` (Dropdowns), `bg-muted` (Secondary areas).
- **Text:** `text-foreground` (Body), `text-muted-foreground` (Subtitles/Labels).
- **Interactive:** `bg-primary`, `bg-secondary`, `bg-destructive`, `bg-accent` (Hover).
- **Borders:** `border-border` (Dividers), `border-input` (Forms).
- **Exception:** You MAY use utility colors (e.g., `text-blue-600`) ONLY for data-specific status (badges, charts).

### Behavioral Rules
- **Overflow:** Main content area MUST utilize `flex-1 overflow-y-auto` to prevent body scroll.
- **URL State:** Sync Tabs, Filters, and Search to URL Query Params (TanStack Router).
- **Z-Index:** Always use Portals for floating elements (Dialogs, Tooltips).

### Error Handling
- ALWAYS implement `errorComponent` for major routes.

### Type Safety
- **For forms/actions**: Use Zod schemas. Always `z.infer<typeof Schema>`.
- **For read operations**: Define entity types in `src/types/common.d.ts` first, then import and use.

### Icons
- Only use `lucide-react`.

### API Response Contract
- **Lists:** `{ items: [], page, limit, total, totalPages }` → `PaginatedResponse<T>`.
- **Details:** Returns object directly → `SingleResponse<T> = T`.

### i18n Rules
- Never hardcode text. Add key to `src/lib/i18n/locales/en/{namespace}.json` first.
- Use `useTranslation('namespace')`.
- Nested keys: `t('benefits.manageClasses')`.

### Utilities Usage
- Styling: `cn()` from `@/lib/utils/cn`.
- Env: `env` from `@/lib/utils/env`.
- Fetching: Query factory (`queries.ts`) + `queryOptions`.
