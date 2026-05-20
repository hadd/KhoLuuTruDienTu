---
trigger: always_on
description: Directory structure, feature-based organization, and routing patterns
globs:
---
# Project Structure & Routing

Cấu trúc được tối ưu để Agent dễ dàng tìm file (**"Locality of Behavior"**).

## Directory Structure

### Feature-Based Organization
- **Features**: `src/features/` - Business logic organized by domain
  - Each feature contains: `components/`, `api/`, `schemas.ts`, `queries.ts`
  - Colocate related files together (Locality of Behavior)
- **Routes**: `src/app/routes/` - File-based routing (TanStack Router)
- **Shared UI**: `src/components/ui/` (Shadcn primitives), `src/components/common/` (shared components)
- **Infrastructure**: `src/lib/` - Core utilities, API config, i18n setup
- **Types**: `src/types/` - Global type definitions

## Thin Route Pattern

Routes act as **controllers**, features act as **views**:

### Route (Controller) - `app/routes/xxx.tsx`
- Validate URL params (`validateSearch`)
- Check auth/redirect (`beforeLoad`)
- Prefetch data (`loader` + `queryClient.ensureQueryData`)
- Render feature component from `features/`

### Feature Component (View) - `features/xxx/components/xxx.tsx`
- Use `useQuery` (hydrated from loader)
- Render UI & handle interactions

## Golden Example: Feature Structure

When creating a feature "Students", it MUST look like this:

```
src/features/students/
├── api/
│   └── studentClient.ts          # API calls (GET, POST, PUT, DELETE)
├── components/
│   ├── StudentList.tsx           # Main list component
│   ├── StudentForm.tsx           # Form component (create/edit)
│   ├── StudentSheet.tsx          # Sheet wrapper for form
│   └── studentColumns.tsx        # Table column definitions
├── queries.ts                    # TanStack Query options
└── schemas.ts                    # Zod schemas for forms
```

**Route file** (separate from feature):
```
src/app/routes/school-management/students.tsx  # Route (controller)
```

## Common Patterns

### Creating a New Feature
1. **For read operations**: Define entity types in `src/types/common.d.ts` first (if not exists)
2. Create `src/features/{featureName}/`
3. Add `components/`, `api/`, `schemas.ts`, `queries.ts`
   - **For forms/actions**: Create Zod schemas in `schemas.ts`
   - **For read operations**: Import entity types from `@/types/common` in `api/` and `queries.ts`
4. Create route in `src/app/routes/{featureName}.tsx`
5. Route loads data, feature component renders UI

### Adding a New Route
1. Create file in `src/app/routes/{routeName}.tsx`
2. Implement `loader` for data prefetching
3. Use `validateSearch` for URL params validation
4. Use `beforeLoad` for auth checks
5. Render component from `features/`

**For nested routes and routing patterns**, see `routing.mdc` rule file.

---

**Key Principle**: Keep routes thin - move business logic to features. Routes are controllers, features are views.
