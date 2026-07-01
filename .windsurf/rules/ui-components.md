---
trigger: model_decision
description: Reusable UI component patterns and best practices
globs:
---

# UI Components Guide

This guide documents reusable UI components and patterns to ensure consistency across the application.

## StatusBadge Component

### When to Use

- **ALWAYS** use `StatusBadge` for displaying entity statuses (published, draft, pending, etc.)
- Use for: Questions, Assignments, Courses, Submissions, Grading History, etc.

### How to Use

```typescript
import { StatusBadge } from '@/components/common/StatusBadge'

// ✅ Correct - Basic usage
<StatusBadge status="published" />

// ✅ Correct - With border
<StatusBadge status="pending" includeBorder />

// ✅ Correct - With custom label (for namespace-specific translations)
<StatusBadge
  status={history.status}
  label={t('examGrading.history.status.pending')}
/>

// ✅ Correct - With explicit language
<StatusBadge status="approved" lang="en" />
```

### What NOT to Do

```typescript
// ❌ Wrong - Don't hardcode status badge styles
<Badge className="bg-emerald-100 text-emerald-700">Published</Badge>

// ❌ Wrong - Don't create custom status config helpers
const statusConfig = {
  published: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-gray-100 text-gray-700',
}
<Badge className={statusConfig[status]}>Published</Badge>

// ❌ Wrong - Don't use getStatusBadgeClass directly in components
const classes = getStatusBadgeClass(status)
<Badge className={classes}>Published</Badge>
// Use StatusBadge component instead
```

### Available Status Values

Use `StatusValue` type for type safety:

- Common: `draft`, `active`, `published`, `archived`, `inactive`, `closed`
- Assignment: `pending`, `submitted`, `graded`
- Question: `under_review`, `approved`, `rejected`
- Grading: `processing`, `done`, `error`
- Student: `enrolled`, `withdrawn`, `graduated`, `transferred`, `suspended`

### Reference Implementation

See `src/features/question-studio/components/left-panel/question-list/QuestionCard.tsx` for a golden example.

## Category Badge Components

**Location**: `@/components/common/CategoryBadge`

**When to Use**: Always for displaying category values (grade/subject/level, gender, etc.)

**Quick Reference**:

- `<CategoryBadge type="grade" value="lop-10" />` - For grades, subjects, levels
- Use appropriate badge components for other category types (see component files)
- Badge components use centralized constants from `@/lib/constants/categories` (no direct i18n calls)

**See component files for complete API documentation.**

## Card Component Variants

### When to Use

- **ALWAYS** use `Card` component for container elements
- Use appropriate variant based on context

### Available Variants

- `default` - Standard card (current behavior)
- `list` - For list items (minimal padding, consistent spacing)
- `detail` - For detail views (more padding, structured layout)
- `hover` - Adds hover effect (`hover:bg-accent`)
- `interactive` - Clickable cards (cursor pointer, hover effects)
- `bordered` - Enhanced border styling

### How to Use

```typescript
import { Card, CardHeader, CardContent } from '@/components/ui/card'

// ✅ Correct - Interactive card (clickable)
<Card variant="interactive">
  <CardHeader>Title</CardHeader>
  <CardContent>Content</CardContent>
</Card>

// ✅ Correct - List item card
<Card variant="list">
  <CardContent>List item</CardContent>
</Card>

// ✅ Correct - Detail view card
<Card variant="detail">
  <CardHeader>Detail Title</CardHeader>
  <CardContent>Detail content</CardContent>
</Card>
```

### What NOT to Do

```typescript
// ❌ Wrong - Don't replicate card styles
<div className="rounded-lg border bg-card text-card-foreground shadow-sm">
  Content
</div>

// ❌ Wrong - Don't use raw divs for card-like containers
<div className="bg-white border rounded-lg p-4">
  Content
</div>
```

### Reference Implementation

See `src/features/question-studio/components/left-panel/question-list/QuestionCard.tsx` for card variant usage.

## SearchSelect Component

### When to Use

- **ALWAYS** use `SearchSelect` or factory helpers for searchable select components
- Use for: Teacher selection, Learning Standard selection, Student selection, etc.

### How to Use

```typescript
import { createTeacherSearchSelect } from '@/components/common/search-select-helpers'

// ✅ Correct - Use factory helper
const TeacherSelect = createTeacherSearchSelect()
<TeacherSelect value={value} onChange={setValue} />

// ✅ Correct - Use generic component directly
import { SearchSelect } from '@/components/common/SearchSelect'
<SearchSelect
  queryOptions={teachersQueryOptions(schoolId)}
  getOptionValue={(t) => t.id}
  getOptionLabel={(t) => t.name}
  value={value}
  onChange={setValue}
/>
```

### What NOT to Do

```typescript
// ❌ Wrong - Don't create custom search select components
export function CustomSearchSelect() {
  return (
    <Popover>
      <PopoverTrigger>
        <Button>Select...</Button>
      </PopoverTrigger>
      <PopoverContent>
        <Command>
          {/* Custom implementation */}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ❌ Wrong - Don't duplicate search select patterns
// Use SearchSelect or factory helpers instead
```

### Available Factory Helpers

- `createTeacherSearchSelect()` - For teacher selection
- `createLearningStandardSearchSelect()` - For learning standard selection
- `createStudentSearchSelect()` - For student selection (single)
- `createSubjectSearchSelect()` - For subject selection with search

### Reference Implementation

See `src/features/school-management/components/TeacherSearchSelect.tsx` (after refactoring) for factory helper usage.

## DataTableRowActions Component

### When to Use

- **ALWAYS** use `DataTableRowActions` for action buttons in table columns
- Use for: Edit, Delete, View, and custom actions in table rows
- Provides consistent styling and behavior across all tables

### How to Use

```typescript
import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'

// ✅ Correct - Basic usage
<DataTableRowActions
  row={row}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>

// ✅ Correct - With View action
<DataTableRowActions
  row={row}
  onView={handleView}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>

// ✅ Correct - With custom actions
import { Copy, Archive } from 'lucide-react'

const customActions = [
  {
    id: 'duplicate',
    icon: Copy,
    label: 'Duplicate',
    onClick: (item) => handleDuplicate(item),
    variant: 'outline' as const,
  },
  {
    id: 'archive',
    icon: Archive,
    onClick: (item) => handleArchive(item),
    disabled: item.isArchived,
  },
]

<DataTableRowActions
  row={row}
  onEdit={handleEdit}
  onDelete={handleDelete}
  actions={customActions}
/>
```

### What NOT to Do

```typescript
// ❌ Wrong - Don't create inline action buttons
<div className="flex items-center justify-end gap-1">
  <Button onClick={() => onEdit(row.original)}>
    <Edit />
  </Button>
  <Button onClick={() => onDelete(row.original)}>
    <Trash />
  </Button>
</div>

// ❌ Wrong - Don't hardcode button styles
<Button variant="ghost" size="sm" className="h-8">
  <Edit className="h-4 w-4" />
</Button>
```

### Component API

```typescript
interface DataTableRowActionsProps<TData> {
  row: Row<TData>
  onView?: (item: TData) => void
  onEdit?: (item: TData) => void
  onDelete?: (item: TData) => void
  actions?: Array<TableAction<TData>>
  children?: React.ReactNode
  className?: string
  gap?: 'sm' | 'md' | 'lg'
  size?: 'sm' | 'md'
  variant?: 'outline' | 'ghost'
}
```

### Smart Defaults

- Button style: `variant="outline" size="sm" className="h-7"`
- Icon size: `h-3.5 w-3.5`
- Gap: `gap-1`
- Icons: `Edit`, `Trash`, `Eye` from `lucide-react`

### Reference Implementation

See:

- `src/components/common/data-table/data-table-row-actions.tsx` - Component implementation
- `src/features/academic-years/components/academicYearColumns.tsx` - Usage example

## TextBlock Component

### When to Use

- **ALWAYS** use `TextBlock` for handling text overflow with ellipsis
- Use for: Table cells, card content, list items, and any place where text may overflow
- Automatically shows tooltip on hover when content is truncated
- Supports single-line and multi-line truncation

### How to Use

```typescript
import { TextBlock } from '@/components/common/TextBlock'

// ✅ Correct - Single line truncation (default)
<TextBlock>Long text that will be truncated with ellipsis</TextBlock>

// ✅ Correct - Multi-line truncation
<TextBlock lines={2}>
  Long text that will be truncated after 2 lines with ellipsis
</TextBlock>

// ✅ Correct - With width constraint
<TextBlock width={200}>Text with max width of 200px</TextBlock>
<TextBlock width="50%">Text with max width of 50%</TextBlock>

// ✅ Correct - Custom element type
<TextBlock as="span" lines={1}>Inline truncated text</TextBlock>

// ✅ Correct - In table cells (Primary Cell Pattern)
<Link
  to="/path/to/item/$id"
  params={{ id: item.id }}
  className="font-semibold hover:underline block"
>
  <TextBlock lines={1}>{item.name}</TextBlock>
</Link>

// ✅ Correct - In table cells (regular cells)
cell: ({ row }) => (
  <TextBlock lines={1} className="text-muted-foreground">
    {row.original.description}
  </TextBlock>
)

// ✅ Correct - Custom tooltip text
<TextBlock tooltip="Custom tooltip text">Content</TextBlock>

// ✅ Correct - Disable tooltip
<TextBlock tooltip={null}>Content that won't show tooltip</TextBlock>
```

### What NOT to Do

```typescript
// ❌ Wrong - Don't use raw truncate class without TextBlock
<div className="truncate">{item.name}</div>

// ❌ Wrong - Don't manually add title attributes for tooltips
<div className="truncate" title={item.name}>{item.name}</div>

// ❌ Wrong - Don't create custom overflow handling components
function CustomTruncate({ children }) {
  return <div className="truncate">{children}</div>
}

// ❌ Wrong - Don't use line-clamp directly without TextBlock
<div className="line-clamp-2">{content}</div>

// ❌ Wrong - Don't duplicate truncation logic
// Use TextBlock component for consistency and automatic tooltip
```

### Component API

```typescript
interface TextBlockProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Number of lines to display before truncation (default: 1)
   * For single line, uses `truncate` class
   * For multiple lines, uses `line-clamp-{n}` utility
   */
  lines?: number

  /**
   * Maximum width constraint
   * Can be a number (treated as pixels) or a string (e.g., "200px", "50%", "10rem")
   */
  width?: string | number

  /**
   * HTML element to render (default: "div")
   */
  as?: keyof React.JSX.IntrinsicElements

  /**
   * Custom tooltip text. If not provided, will extract text from children.
   * Set to null to disable tooltip.
   */
  tooltip?: string | null

  children: React.ReactNode
}
```

### Features

- **Automatic Truncation Detection**: Uses `ResizeObserver` to detect if content is actually truncated
- **Smart Tooltip**: Only shows tooltip when content is truncated (not when fully visible)
- **Text Extraction**: Automatically extracts plain text from React children for tooltip
- **Single-line & Multi-line**: Supports both `truncate` (single-line) and `line-clamp-{n}` (multi-line)
- **Width Constraints**: Optional width limits via `width` prop
- **Custom Element Types**: Can render as any HTML element via `as` prop

### Reference Implementation

See:

- `src/components/common/TextBlock.tsx` - Component implementation
- `src/features/learning-standards/components/learningStandardColumns.tsx` - Usage in table cells

## Common Mistakes to Avoid

1. **Hardcoding status badge styles** - Always use `StatusBadge` component
2. **Replicating card styles** - Always use `Card` component with variants
3. **Creating custom search selects** - Always use `SearchSelect` or factory helpers
4. **Creating inline action buttons** - Always use `DataTableRowActions` component
5. **Using raw truncate class** - Always use `TextBlock` component for overflow content
6. **Not using TypeScript types** - Use `StatusValue`, `CardVariant` types for type safety
7. **Ignoring component documentation** - Check JSDoc examples in component files

## Migration Guide

If you find old patterns in the codebase:

1. **Status Badges**: Replace hardcoded badges with `<StatusBadge status={...} />`
2. **Cards**: Replace raw divs with `<Card variant={...}>`
3. **Search Selects**: Replace custom components with `SearchSelect` or factory helpers
4. **Action Buttons**: Replace inline action buttons with `<DataTableRowActions row={row} ... />`
5. **Text Overflow**: Replace `truncate` class and manual `title` attributes with `<TextBlock lines={1}>`

See component files for `@deprecated` tags indicating old patterns to avoid.
