---
trigger: model_decision
description: TanStack Router patterns, nested routes, and routing best practices
globs:
---

# Routing Patterns & Best Practices

## Quick Reference

**Critical Rules:**
- Parent routes with children → Use `<Outlet />`, not direct render
- Navigation → Always use `search: (prev) => ({ ...prev, ... })` to preserve URL params
- Layouts → Child routes decide layout, not parent
- Paths → Use `to: '.'` (relative) instead of absolute paths

**Layout Decision Matrix:**
| Route Type | Return |
| :--- | :--- |
| Parent (has children) | `<Outlet />` |
| Standard Page | `<DashboardLayout><Component /></DashboardLayout>` |
| Immersive Tool | `<Component />` (full screen) |

## Nested Routes Pattern (CRITICAL)

**Issue**: Parent route must use `<Outlet />` instead of directly rendering, otherwise child routes won't render.

```typescript
// ✅ CORRECT: Parent uses Outlet
// lessons.$lessonId.tsx
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/lessons/$lessonId')({
  component: LessonDetailRoute,
})

function LessonDetailRoute() {
  return <Outlet />  // ✅ CRITICAL
}

// lessons/$lessonId/index.tsx (default content)
export const Route = createFileRoute('/lessons/$lessonId/')({
  component: LessonDetailIndexRoute,
})

function LessonDetailIndexRoute() {
  return (
    <DashboardLayout>
      <LessonDetail />
    </DashboardLayout>
  )
}

// lessons/$lessonId/question-studio.tsx (child route)
export const Route = createFileRoute('/lessons/$lessonId/question-studio')({
  component: QuestionStudioRoute,
})

function QuestionStudioRoute() {
  return <QuestionStudio />  // Custom layout
}
```

```typescript
// ❌ WRONG: Direct render prevents child routes
function LessonDetailRoute() {
  return (
    <DashboardLayout>
      <LessonDetail />  // ❌ Child routes won't render!
    </DashboardLayout>
  )
}
```

**Checklist when adding child routes:**
1. Change parent to `<Outlet />`
2. Create `{parent}/index.tsx` for default content
3. Each child route decides its own layout

## Layout Decision Pattern

**Rule**: Layout decisions made at child route level, not parent.

- **Parent Route**: Return `<Outlet />` only (no layout)
- **Standard Page**: Wrap in `<DashboardLayout>`
- **Immersive Tool**: No layout (component defines own)

**Example: Parent with Layout, Children Inherit**

```typescript
// Parent: learning-standards.tsx
function LearningStandardsLayoutRoute() {
  return (
    <DashboardLayout>
      <Outlet />  // Children inherit layout
    </DashboardLayout>
  )
}

// Child: learning-standards.$standardId.tsx
function LearningStandardDetailRoute() {
  return <LearningStandardDetail />  // No DashboardLayout (parent has it)
}
```

## URL State Preservation Pattern (CRITICAL)

**Issue**: Hardcoded search objects replace ALL URL params, losing filters/pagination.

```typescript
// ❌ WRONG: Loses all existing params
const handleEdit = (student: StudentT) => {
  navigate({
    to: '/school-management/students',
    search: {
      page: 1,
      limit: 10,
      id: student.id,  // Loses filters!
    },
  })
}
```

```typescript
// ✅ CORRECT: Preserves existing params
const handleEdit = (student: StudentT) => {
  navigate({
    to: '.',  // Relative path
    search: (prev) => ({
      ...prev,  // Spread existing params
      id: student.id,  // Only update what you need
    }),
  })
}
```

**Pattern for List Pages:**

```typescript
// Update pagination
navigate({
  to: '.',
  search: (prev) => ({ ...prev, page: 2, limit: 20 }),
})

// Update sorting
navigate({
  to: '.',
  search: (prev) => ({ ...prev, sort: 'name' }),
})

// Open sheet (add id)
navigate({
  to: '.',
  search: (prev) => ({ ...prev, id: item.id }),
})

// Close sheet (remove id)
navigate({
  to: '.',
  search: (prev) => ({ ...prev, id: undefined }),
})

// Update filters
navigate({
  to: '.',
  search: (prev) => ({ ...prev, ...filters, page: 1 }),
})
```

**Link Components:**

```typescript
// ✅ CORRECT
<Link
  to="."
  search={(prev) => ({ ...prev, id: student.id })}
>
  {student.name}
</Link>

// ❌ WRONG
<Link
  to="/school-management/students"
  search={{ page: 1, id: student.id }}  // Loses filters!
>
  {student.name}
</Link>
```

**Common Pitfalls:**
1. Hardcoded search object → Use functional updater
2. Absolute path → Use `to: '.'`
3. Forgetting `...prev` → Always spread existing params
4. Wrong removal → Use `undefined`, not deletion

## Common Patterns

### Single Route (No Children)

```typescript
export const Route = createFileRoute('/school-management/teachers')({
  component: TeachersRoute,
})

function TeachersRoute() {
  return (
    <DashboardLayout>
      <TeachersList />
    </DashboardLayout>
  )
}
```

### Route with Loader

```typescript
export const Route = createFileRoute('/lessons/$lessonId')({
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    const schoolId = getCurrentSchoolId()
    const lesson = await context.queryClient.ensureQueryData(
      lessonDetailQueryOptions(schoolId, params.lessonId),
    )
    return { lesson }
  },
  component: LessonDetailRoute,
})
```

### Loader Data Inheritance

```typescript
// Child component accessing parent data
import { useRouteLoaderData } from '@tanstack/react-router'

function ChildComponent() {
  const parentData = useRouteLoaderData({ from: '/lessons/$lessonId' })
  return <div>{parentData.lesson.title}</div>
}
```

### Route with Breadcrumb

```typescript
export const Route = createFileRoute('/lessons/$lessonId')({
  staticData: {
    crumb: (data: { lesson: { title: string } }) => ({
      label: data.lesson.title,
      parent: { label: 'Lessons', to: '/lessons' },
    }),
  },
  component: LessonDetailRoute,
})
```

## Configuration Rules

### Generated Files
- **File**: `src/app/routeTree.gen.ts`
- **Rule**: NEVER edit manually - auto-generated by TanStack Router

### File Naming
- Nested routes: Use directory structure `lessons/$lessonId/index.tsx`
- Default child: MUST be named `index.tsx`

## Key Principles

1. Parent routes with children → `<Outlet />`
2. Create index route when converting to Outlet pattern
3. Layout decisions at child route level
4. Use directory structure for nested routes
5. **ALWAYS preserve URL params** - use `search: (prev) => ({ ...prev, ... })`
6. Use relative paths (`to: '.'`) not absolute
7. Inherit data from parents instead of refetching

---

**Critical Rules**: 
- Parent routes MUST use `<Outlet />` for child routes to render
- **NEVER** use hardcoded search objects - always use functional updaters to preserve URL params
