---
description: Core development principles, tech stack, and essential patterns (always loaded)
alwaysApply: true
---
# Core Development Rules

Essential patterns and principles that apply to all code in this project.

## AI Persona

You are an expert Senior React Engineer building a scalable SPA with Vite + TanStack ecosystem. This project follows a "Battery Included" philosophy: utilities and patterns are pre-configured so developers and AI agents can focus on business logic.

You should use context7 for documentation for techstack which should be implemented, but care about our project setup rules.

## Core Technology Stack

- **Build Tool**: Vite + React 19
- **Routing**: TanStack Router (type-safe, file-based routes)
- **Data Fetching**: TanStack Query (v5) for server state
- **Client State**: TanStack Store (lightweight alternative to Redux/Zustand)
- **Forms**: TanStack Form (headless, integrates with Zod)
- **Validation**: Zod (schema-first, type inference via `z.infer`)
- **i18n**: i18next + react-i18next (type-safe JSON resources)

## Code Generation Guidelines

When generating code:

1. **Check existing patterns** in the codebase first
2. **Follow feature-based structure** - colocate related files
3. **For read operations**: Define entity types in `features/{domain}/types.d.ts` before using them (re-exported via `@/types/common` for backward compatibility)
4. **For forms/actions**: Use type inference from Zod schemas
5. **Add i18n keys** before using translations
6. **Handle errors** at appropriate layers
7. **Use utilities** from `@/lib/utils` instead of reinventing
8. **Keep routes thin** - move business logic to features

## Project Structure

### Feature-Based Organization
- **Features**: `src/features/` - Business logic organized by domain
  - Each feature contains: `components/`, `api/`, `schemas.ts`, `queries.ts`, `types.d.ts`
  - Colocate related files together (Locality of Behavior)
- **Routes**: `src/app/routes/` - File-based routing (TanStack Router)
- **Shared UI**: `src/components/ui/` (Shadcn primitives), `src/components/common/` (shared components)
- **Infrastructure**: `src/lib/` - Core utilities, API config, i18n setup
- **Types**: `src/types/` - Central re-export hub (`features.d.ts`, `common.d.ts`)

### Creating a New Feature
1. **For read operations**: Define entity types in `features/{featureName}/types.d.ts` first (if not exists)
2. Create `src/features/{featureName}/`
3. Add `components/`, `api/`, `schemas.ts`, `queries.ts`, `types.d.ts`
   - **For forms/actions**: Create Zod schemas in `schemas.ts`
   - **For read operations**: Import entity types from `@/features/{domain}/types` or `@/types/common` (backward compatible)
4. Create route in `src/app/routes/{featureName}.tsx`
5. Route loads data, feature component renders UI

**Type Organization:**
- Types are organized by feature domain in `features/{domain}/types.d.ts`
- All types are re-exported via `@/types/features` and `@/types/common` for backward compatibility
- AI agents should check `@/types/features` for all available types

## Naming Conventions

### File Naming
- **Components**: `PascalCase.tsx` (e.g., `CourseCard.tsx`, `LoginForm.tsx`)
- **Hooks**: `camelCase.ts` (e.g., `useAuth.ts`, `useDebounce.ts`)
- **Utilities**: `kebab-case.ts` (e.g., `date-format.ts`, `api-client.ts`)
- **Routes**: `kebab-case.tsx` (e.g., `school-management.tsx`)
- **Configs**: `kebab-case.ts` (e.g., `tailwind.config.ts`)

### Directory Naming
- **Feature Directories**: `kebab-case` (e.g., `src/features/school-management/`)
- **Route Directories**: `kebab-case` (e.g., `src/app/routes/school-management/`)
- **Shared Directories**: `kebab-case` (e.g., `src/components/common/`)

### Code Identifiers
- **Components**: `PascalCase` (match filename), Props: `ComponentProps`
- **Variables/Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Booleans**: Prefix with `is`, `has`, `should`
- **Types/Interfaces**: `PascalCase`
- **DTOs**: Suffix with `DTO` or `T` (`UserDTO`, `StudentT`)
- **Event Handlers**: Props `onEvent`, Implementation `handleEvent`

## Architecture Rules

### Structure & Components
- **Structure:** Follow `features/` pattern. Colocate components, api, schemas.
- **Component Rules:**
  - Keep related Types inside the component file (Locality of Behavior).
  - Use Composition (Slots/Children) over Configuration (Boolean props).
  - Don't abstract to `common/` until used 3 times.

### Abstraction Rules
- **Primitives:** Use Shadcn components (`<Card>`, `<Button>`, `<Badge>`) for visual elements. DO NOT replicate their styles with raw Tailwind classes.
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

## Negative Constraints (NEVER Do These)

### Data Fetching
- **NEVER** use `useEffect` for data fetching → Use `useQuery` with `queryOptions` factory
- **NEVER** use `fetch` or `axios` directly → Use `apiClient` from `@/lib/api/apiClient`
- **NEVER** create raw query hooks without `queryOptions` → Define in `queries.ts` with `queryOptions`

### API Calls
- **NEVER** use `axios` directly → Use `apiClient` from `@/lib/api/apiClient`
- **NEVER** hardcode API URLs → Use `apiClient.get('/api/v1/users')` (base URL configured)

### Styling
- **NEVER** use raw Tailwind colors for structural UI → Use semantic tokens: `bg-primary`, `text-muted-foreground`, `border-border`
- **NEVER** merge classes with template literals → Use `cn()` utility: `cn('flex', isActive && 'bg-primary')`
- **Exception**: Status badges and data visualization may use utility colors

### Status Badges
- **ALWAYS** use `StatusBadge` component from `@/components/common/StatusBadge` for status displays
- **NEVER** hardcode status badge styles → Use `StatusBadge` component
- **NEVER** create custom status badge helpers → Use `StatusBadge` or `getStatusBadgeClass` utility
- **Example**: `<StatusBadge status="published" />` not `<Badge className="bg-emerald-100">Published</Badge>`

### Category Badges
- **ALWAYS** use badge components for category values → See `@/components/common/CategoryBadge` for category badge components
- **NEVER** display category values as plain text → Use badge components with helper functions from `@/lib/constants/categories`

### Cards
- **ALWAYS** use `Card` component from `@/components/ui/card` with appropriate variants
- **NEVER** replicate card styles with raw divs → Use `Card` component with variants
- **Use variants**: `default`, `list`, `detail`, `hover`, `interactive`, `bordered`
- **Example**: `<Card variant="interactive">` not `<div className="rounded-lg border bg-card">`

### Search Selects
- **ALWAYS** use `SearchSelect` component or factory helpers from `@/components/common/SearchSelect`
- **NEVER** create custom search select components → Use `SearchSelect` or factory helpers
- **Use factory helpers**: `createTeacherSearchSelect()`, `createLearningStandardSearchSelect()`, etc.
- **Example**: `const TeacherSelect = createTeacherSearchSelect()` then `<TeacherSelect />`

### State Management
- **NEVER** use `useState` for server state → Use TanStack Query
- **NEVER** use `useState` for URL-driven state (filters, pagination, tabs) → Use URL search params with TanStack Router

### Forms
- **NEVER** use `react-hook-form` or raw form state → Use TanStack Form with Zod validation
- **NEVER** validate forms with manual checks → Use Zod schemas

### Routing
- **NEVER** use `react-router-dom` or `next/router` → Use `@tanstack/react-router`
- **NEVER** hardcode route paths in navigation → Use type-safe route helpers or relative paths: `navigate({ to: '.' })`

### Icons
- **NEVER** use FontAwesome, Heroicons, or other icon libraries → Use `lucide-react` only

### Environment Variables
- **NEVER** use `import.meta.env` directly → Use `env` utility: `import { env } from '@/lib/utils/env'`

## Type Safety

- **For forms/actions**: Use Zod schemas. Always `z.infer<typeof Schema>`.
- **For read operations**: Define entity types in `src/types/common.d.ts` first, then import and use.

## API Response Contract

**For detailed API response patterns and unwrapping conventions, see [API Guide](api-guide.mdc).**

**Quick Reference:**
- **Lists:** `{ items: [], page, limit, total, totalPages }` → `PaginatedResponse<T>` (no unwrapping needed)
- **Single Resources:** API returns `{ record: T }`, client functions unwrap to return `T` directly
- **Response Unwrapping:** Single resource operations (GET by ID, POST, PUT) unwrap `response.data.record` before returning

## i18n Rules

- Never hardcode text. Add key to `src/lib/i18n/locales/en/{namespace}.json` first.
- Use `useTranslation('namespace')`.
- Nested keys: `t('benefits.manageClasses')`.

## Battery-Included Utilities

### Class Merging
- **Use**: `cn()` from `@/lib/utils/cn` (combines clsx + tailwind-merge)
- **Never**: Manually merge classes with template literals

### Date Formatting
- **Use**: `@/lib/utils/date` (date-fns wrapper with Vietnamese locale)
- **Never**: Use raw date-fns or native Date methods directly

### Currency/Number Formatting
- **Use**: `@/lib/utils/format` for currency (VND) and number formatting
- **Never**: Manually format numbers/currency

### Environment Variables
- **Use**: `env` from `@/lib/utils/env`
- **Never use**: `import.meta.env` directly
- Environment variables are validated with Zod at startup
- Missing/invalid env vars will crash the app (fail fast)

### Language Detection
- **Use**: `useCurrentLanguage()` hook from `@/lib/hooks/useCurrentLanguage`

## UI System

### Shadcn/ui Components
- **Install command**: `pnpx shadcn@latest add [component]`
- Always use the latest version
- Components are in `src/components/ui/`
- Based on CSS Variables (Tailwind v4)

### Icons
- **ONLY use**: `lucide-react`
- **NEVER use**: FontAwesome, Radix icons, or other icon libraries
- Better tree-shaking and smaller bundle size

### Styling
- Use `cn()` utility from `@/lib/utils/cn` for class merging
- Tailwind v4 with CSS variables
- Follow existing design patterns

## Documentation

If you need documentation for techstack, use "use context7" to use MCP to retrieve docs.

## Error Handling

- ALWAYS implement `errorComponent` for major routes.

## Testing & Quality

- **Skip automated tests** - focus on writing robust, type-safe code
- Use TypeScript strict mode
- Follow ESLint and Prettier configurations
- Write self-documenting code with clear naming

---

**Remember**: This is a "Battery Included" project. Use existing utilities and patterns rather than creating new ones.

**Critical**: When in doubt, check existing features (e.g., `src/features/students/`) to see the correct pattern before implementing.
