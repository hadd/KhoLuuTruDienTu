---
trigger: model_decision
description: API patterns, state management, validation, and forms
globs:
---

# Data, Forms & API Patterns

## Type Safety & Validation

### Zod-First Approach

- **Always use Zod schemas** for forms and API validation
- **Never write manual interfaces** when a Zod schema exists
- **Type reuse**: `export type LoginForm = z.infer<typeof LoginSchema>`
- Zod is the "source of truth" - infer types from schemas
- **Scope**: Applies to **forms, create/update/action features** (user input validation)

```typescript
// features/auth/schemas.ts
import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type LoginForm = z.infer<typeof LoginSchema>
```

## API & Network Patterns

### API Client

- **Always use**: `apiClient` from `@/lib/api/apiClient`
- **Never use**: Raw axios instances
- Token refresh is handled automatically by the interceptor

### API Response Contracts

**For complete API response patterns, query parameters, filter serialization, and unwrapping conventions, see [API Guide](api-guide.mdc).**

**Quick Reference:**

- **List Resources**: `PaginatedResponse<T>` with `{ items, page, limit, total, totalPages }` - no unwrapping needed
- **Single Resources**: API returns `{ record: T }`, client functions unwrap to return `T` directly
- **Response Unwrapping**: Single resource operations (GET by ID, POST, PUT) use `response.data.record` before returning
- **Filter Serialization**: Use `serializeFilter` from `@/lib/api/filter-utils` (see [Reusable Patterns Guide](reusable-patterns.mdc))

### Query Factory Pattern

- Define query options in `features/xxx/queries.ts`
- Use `queryOptions` from TanStack Query
- Export query key factories for cache management

### Adding a New API Endpoint

1. **Define entity type** in `features/{feature}/types.d.ts` (if not exists) - see Entity Type Definition Workflow below
2. Add function to `features/{feature}/api/{feature}Client.ts`
3. Create query options in `features/{feature}/queries.ts`
4. Use in route loader or component

### Entity Type Definition Workflow (MANDATORY)

**Rule: Define entity types in `features/{domain}/types.d.ts`, then import and use them.**

**Type Organization:**

- **Feature-based**: Types are organized by feature domain in `features/{domain}/types.d.ts`
- **Central Re-exports**: All feature types are re-exported via `@/types/features` and `@/types/common` for backward compatibility
- **AI Agent Discovery**: AI agents should check `@/types/features` for all available types

**Scope Clarification:**

- **Zod-First Approach**: For forms, create/update/action features (user input validation)
- **Entity Type Definition**: For GET/read operations, API responses, data fetching

**When working with a new entity (e.g., `CourseT`, `StudentT`):**

1. **First Step: Define in `features/{domain}/types.d.ts`**
   - Add the entity interface to the appropriate feature's `types.d.ts` file
   - Export it: `export interface CourseT { ... }`
   - Include all fields from the API response
   - Import related entity types from other features if needed (e.g., `import type { SchoolT } from '@/features/school-management/types'`)

2. **Then: Import and use in feature files**
   - Import from feature types: `import type { CourseT } from '@/features/school-management/types'`
   - Or import from centralized exports (backward compatible): `import type { CourseT } from '@/types/common'`
   - Use in `features/{feature}/api/{feature}Client.ts`, `queries.ts`, and components

3. **Re-export for Discoverability**
   - Types are automatically re-exported via `@/types/features` and `@/types/common`
   - No manual re-export needed - the system handles it automatically

**Why this organization?**

- **Locality of Behavior**: Types live with their feature domain
- **Maintainability**: Easier to find and update types related to a specific feature
- **Backward Compatibility**: Existing imports from `@/types/common` continue to work
- **AI-Friendly**: Central `@/types/features` makes all types discoverable

**Example Workflow:**

```typescript
// Step 1: Define in features/school-management/types.d.ts
import type { SchoolT } from './types' // if SchoolT is in same file
import type { LearningStandardT } from '@/features/learning-standards/types'

export interface CourseT {
  id: string
  name: string
  schoolId: string
  // ... other fields
  school: SchoolT
  learningStandard?: LearningStandardT | null
}

// Step 2: Use in features/teacher/api/courseClient.ts
import type { CourseT } from '@/features/school-management/types'
// Or: import type { CourseT } from '@/types/common' (backward compatible)
export const getMyCourses = async (): Promise<PaginatedResponse<CourseT>> => {
  // ... implementation
}

// Step 3: Use in features/teacher/queries.ts
import type { CourseT } from '@/features/school-management/types'
export const myCoursesQueryOptions = () => queryOptions({
  queryFn: async (): Promise<PaginatedResponse<CourseT>> => { ... }
})

// Step 4: Use in features/teacher/components/CourseCard.tsx
import type { CourseT } from '@/features/school-management/types'
interface CourseCardProps {
  course: CourseT
}
```

## Forms (Battery-Included System)

### The `@/lib/forms` System

Use the project's form system instead of raw TanStack Form:

- **Import**: `import { useAppForm, FormField } from '@/lib/forms'`
- **Never use**: Raw `useForm` from `@tanstack/react-form`

### `useAppForm` Hook

```typescript
const form = useAppForm({
  schema: EntitySchema,      // Zod schema for validation
  defaultValues: { ... },    // Initial values
  onSubmit: async ({ value }) => { ... }
})
```

### `FormField` Component (Auto-Detection)

The `FormField` component reads the Zod schema to auto-detect:

- Field type (text, email, number, boolean, select, textarea, date)
- Required status (shows red asterisk)
- Validation rules

**Key Props:**
| Prop | Type | Description |
|------|------|-------------|
| `form` | AppFormApi | Form instance from `useAppForm` |
| `name` | string | Field name (matches schema key) |
| `label` | string | Field label (use i18n) |
| `as` | FieldType | Override detected type (`'text' \| 'textarea' \| 'date' \| 'select' \| 'boolean' \| 'email' \| 'number'`) |
| `variant` | string | Rendering variant (e.g., `'switch'` for boolean) |
| `render` | function | Escape hatch for custom fields |
| `validateOn` | `'blur' \| 'change' \| 'submit'` | When to validate |

### Adding a New Form

1. Create Zod schema in `features/{feature}/schemas.ts`
2. Use `useAppForm` with schema and defaults
3. Use `FormField` for standard fields (auto-detected)
4. Use `render` prop for custom components (SearchSelect, etc.)

### Golden Example

```typescript
import { useAppForm, FormField } from '@/lib/forms'
import { TeacherSchema } from '../schemas'

function TeacherForm({ teacher, onSubmit }) {
  const form = useAppForm({
    schema: TeacherSchema,
    defaultValues: { name: teacher?.name ?? '' },
    onSubmit: async ({ value }) => await onSubmit(value),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      {/* Auto-detected text field */}
      <FormField form={form} name="name" label={t('form.fields.name.label')} />

      {/* Force textarea */}
      <FormField form={form} name="description" label="Description" as="textarea" />

      {/* Custom field with render prop */}
      <FormField
        form={form}
        name="subjects"
        label="Subjects"
        render={(field) => (
          <SubjectMultiSelect
            value={field.state.value}
            onValueChange={field.handleChange}
          />
        )}
      />
    </form>
  )
}
```

### Zod Error Message Translation

**For complete form validation patterns and `getFieldError` utility usage, see [Reusable Patterns Guide](reusable-patterns.mdc).**

**Quick Reference:**

- **Automatic Translation**: Zod v4 uses built-in locale system for error messages (configured in `src/lib/i18n/config.ts`)
- **Error Helper**: `FormField` handles validation automatically using `getFieldError` from `@/lib/utils/form-validation`
- **No Manual Translation**: Zod validation errors are automatically translated - no need to use `t('xxx.errors.required')`
- **Display**: Errors are shown inline below inputs automatically, never use toast for form validation errors

### Form UX Rules (Placeholders, Required Fields, Width)

- **Placeholders**: Inputs and selects must use muted placeholder styles (`placeholder:text-muted-foreground` or `data-[placeholder]:text-muted-foreground`) so placeholder text is visibly lighter than filled text.
- **Required fields**: Use the \"label + red asterisk\" pattern for required fields (e.g. `Tên danh mục <span className=\"text-destructive\">*</span>`). Do not add extra \"required\" helper text; rely on inline validation error messages when validation fails.
- **Control width in sheets/dialogs**: In CRUD sheets/dialogs, all primary form controls (input, select, search-select, textarea) must use `w-full` so they align vertically. Width differences should come only from explicit grid layouts (e.g. `grid grid-cols-2`) or an overridden width class, not from inconsistent default widths.
- **Patterns to follow**: New forms should follow the visual patterns used in `CategoryForm`, `ClassForm`, and `StudentForm`. Deviations in placeholder color, required markers, or uneven control widths are considered UX bugs and should be corrected.

## State Management

- **Server State**: TanStack Query (v5) - caching, refetching, mutations
- **Client State**: TanStack Store - lightweight UI state
- **Auth State**: `@/features/auth/store` - authentication state management

---

**Key Principles**:

- Zod-first: Always infer types from schemas (for forms/actions)
- **Entity types first**: Define in `common.d.ts` before using (for read operations)
- Use `apiClient` for all network requests
- Inline form errors, never toast for validation
