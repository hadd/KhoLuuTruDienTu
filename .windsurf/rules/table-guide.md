---
trigger: model_decision
description: Standardized table development guide with Primary Cell Navigation and URL-Driven State
globs:
---
# Table & Data Grid Development Rules

## 1. Architecture

- **Wrapper:** ALWAYS use the common `<DataTable />` component located at `@/components/common/data-table/data-table`.

- **Definition:** Define column structure in a separate `columns.tsx` file.

- **State:** Table state (Pagination, Sorting, Filtering) MUST be driven by URL Search Params (TanStack Router), NOT local state.

## 2. Interaction & UX (Primary Cell Pattern)

- **NO Row Click:** Do NOT implement `onRowClick` on the Table. Do not make the entire row clickable.

- **Primary Cell:** Identify the main identity column (e.g., Name, Title). Wrap its content in a `<Link>` component from `@tanstack/react-router` for navigation.
  - Style: `font-semibold hover:underline block` on Link, with `<TextBlock lines={1}>` wrapping the text content.
  - **ALWAYS** use `TextBlock` component for overflow handling - it automatically shows tooltip on hover when content is truncated.

**Implementation Example:**

```typescript
import { Link } from '@tanstack/react-router'
import { TextBlock } from '@/components/common/TextBlock'

{
  accessorKey: 'name',
  cell: ({ row }) => {
    const item = row.original
    return (
      <Link
        to="/path/to/item/$id"
        params={{ id: item.id }}
        className="font-semibold hover:underline block"
      >
        <TextBlock lines={1}>{item.name}</TextBlock>
      </Link>
    )
  },
}
```

- **Selection:** Add `select-all` class to cells containing IDs, Codes, or Money for easy copying.

## 3. Formatting Standards

### 3.1. Text Alignment Rule (MANDATORY)

**CRITICAL:** Column headers and cell data MUST always have the same text alignment. This ensures visual consistency and professional appearance.

**Alignment Rules:**

- **Text Columns (default):** Left-aligned (`text-left` or default). Header uses `<DataTableColumnHeader>` without alignment class, cell uses default alignment.
- **Numbers/Dates/Currency:** Right-aligned (`text-right`). Header uses `<DataTableColumnHeader className="justify-end">`, cell uses `<div className="text-right">`.
- **Actions Column:** Right-aligned. Header uses `<div className="text-right">`, cell uses `<div className="flex items-center justify-end">`.

**Implementation Pattern:**

```typescript
// ✅ CORRECT: Header and cell both right-aligned
{
  accessorKey: 'price',
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Price" className="justify-end" />
  ),
  cell: ({ row }) => (
    <div className="text-right font-mono">
      {formatCurrency(row.original.price)}
    </div>
  ),
}

// ✅ CORRECT: Header and cell both left-aligned (default)
{
  accessorKey: 'name',
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Name" />
  ),
  cell: ({ row }) => (
    <TextBlock lines={1}>
      {row.original.name}
    </TextBlock>
  ),
}

// ❌ WRONG: Header left, cell right (misaligned)
{
  accessorKey: 'amount',
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Amount" />
  ),
  cell: ({ row }) => (
    <div className="text-right">{row.original.amount}</div>  // ❌ Misaligned!
  ),
}
```

**AI Agent Instruction:** When creating or modifying table columns, ALWAYS ensure the header and cell have matching alignment. Check both `header` and `cell` functions to verify alignment consistency.

### 3.2. Column Types

- **Numbers/Dates:** Headers and Cells MUST be aligned right (`text-right`). Use `font-mono` for currency/codes.
- **Headers:** Use `<DataTableColumnHeader>` for sortable columns.
- **Actions Column:**
  - **Alignment:** Actions column MUST be aligned right (`text-right` in header, `justify-end` in cell).
  - **Component:** **ALWAYS** use `<DataTableRowActions />` component for action buttons (see below).
  - **Smart Display Pattern:**
    - **1-2 actions:** Display buttons directly (no dropdown). Use icon buttons with tooltips or text labels.
    - **3+ actions:** Use `<DropdownMenu>` with meatball menu (MoreHorizontal icon).
  - **Column ID:** Must be `id: "actions"` and `enableSorting: false`.
  - **Size:** Typically `size: 120-150px` for direct buttons, `size: 70px` for dropdown menu.

## 4. Row Number Column

- **Default:** Row number column is enabled by default (`showRowNumber={true}`).
- **Toggle:** Use `showRowNumber={false}` to disable if not needed.
- **Display:** Row numbers are calculated based on pagination (if enabled) or row index.
- **Format:** Right-aligned, monospace font, muted color.
- **i18n:** Header uses translation key `common.table.rowNumber` (defaults to "#" in English, "STT" in Vietnamese).
- **Usage:** Useful for easier navigation and reference in long tables.

```typescript
<DataTable
  // ... other props
  showRowNumber={true}  // Optional, defaults to true
/>
```

## 5. Handling Data

- **Loading:** Pass `isLoading` prop to `DataTable`.

- **Empty:** `DataTable` handles empty states automatically.

- **Null Safety:** Always handle potential null values in `columns.tsx` (e.g., `row.original.price ?? 0`).

## 6. Full-Height Table Pattern

- **Container Setup:** Parent containers MUST use flex layout with proper height constraints:
  ```typescript
  <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
    <Card className="flex flex-col flex-1 min-h-0">
      <CardHeader>...</CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        <DataTable className="flex-1" />
      </CardContent>
    </Card>
  </div>
  ```

- **Scrolling:** Table uses `flex-1 overflow-auto` for vertical scrolling. Header is sticky for horizontal scrolling.

- **Height Calculation:** Use `calc(100vh - headerHeight)` to account for fixed headers/navigation.

## 7. Width Stability (Fixed Layout)

- **Table Layout:** DataTable uses `table-layout: fixed` to prevent width jitter when data changes.

- **Column Sizes:** ALWAYS define `size` (width in px) and `minSize` in column definitions:
  ```typescript
  {
    accessorKey: 'name',
    size: 200,        // Preferred width
    minSize: 150,    // Minimum width
    // ...
  }
  ```

- **Cell Truncation:** ALWAYS use `TextBlock` component for truncated cells. It automatically handles overflow with ellipsis and shows tooltip on hover when content is truncated.
  - Use `TextBlock` instead of raw `truncate` class
  - Automatically detects truncation and shows tooltip only when needed
  - Supports single-line (`lines={1}`) and multi-line truncation (`lines={2}`, etc.)
  - See TextBlock component documentation in `ui-components.mdc` for full API

- **Actions Column:** Actions column should have fixed size (e.g., `size: 70, minSize: 70`).

## 8. Pagination UI

- **Props:** Pass `pageCount` (totalPages) and `total` (total items) from `PaginatedResponse` to DataTable:
  ```typescript
  <DataTable
    // ... other props
    pageCount={data?.totalPages}
    total={data?.total}
  />
  ```

- **Display:** DataTablePagination automatically shows:
  - "Showing X to Y of Z results"
  - "Page X of Y"
  - Previous/Next navigation buttons
  - Page size selector (10, 20, 50, 100)

- **API Contract:** Follow `PaginatedResponse<T>` interface from `@/types/api`:
  ```typescript
  interface PaginatedResponse<T> {
    items: T[];
    page: number;        // 1-based
    limit: number;
    total: number;
    totalPages: number;
  }
  ```

## 9. Action Buttons (DataTableRowActions)

### When to Use
- **ALWAYS** use `DataTableRowActions` component for table action buttons
- Use for: Edit, Delete, View, and custom actions in table rows

### How to Use

```typescript
import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'

// ✅ Correct - Basic usage with built-in actions
{
  id: 'actions',
  cell: ({ row }) => (
    <DataTableRowActions
      row={row}
      onEdit={handleEdit}
      onDelete={handleDeleteClick}
    />
  ),
}

// ✅ Correct - With View action
{
  id: 'actions',
  cell: ({ row }) => (
    <DataTableRowActions
      row={row}
      onView={handleView}
      onEdit={handleEdit}
      onDelete={handleDeleteClick}
    />
  ),
}

// ✅ Correct - With custom actions array
import { Copy, Archive } from 'lucide-react'

{
  id: 'actions',
  cell: ({ row }) => {
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

    return (
      <DataTableRowActions
        row={row}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        actions={customActions}
      />
    )
  },
}

// ✅ Correct - With AlertDialog (delete confirmation)
{
  id: 'actions',
  cell: ({ row }) => {
    const item = row.original
    const isDeleting = deleteMutation.isPending && itemToDelete?.id === item.id

    return (
      <>
        <DataTableRowActions
          row={row}
          onEdit={handleEdit}
          onDelete={handleDeleteClick} // Opens dialog, doesn't delete directly
        />
        <AlertDialog
          open={deleteDialogOpen && itemToDelete?.id === item.id}
          onOpenChange={setDeleteDialogOpen}
        >
          {/* Dialog content */}
        </AlertDialog>
      </>
    )
  },
}
```

### What NOT to Do

```typescript
// ❌ Wrong - Don't create inline action buttons
{
  id: 'actions',
  cell: ({ row }) => (
    <div className="flex items-center justify-end gap-1">
      <Button onClick={() => onEdit(row.original)}>
        <Edit />
      </Button>
      <Button onClick={() => onDelete(row.original)}>
        <Trash />
      </Button>
    </div>
  ),
}

// ❌ Wrong - Don't hardcode button styles
<Button variant="ghost" size="sm" className="h-8">
  <Edit className="h-4 w-4" />
</Button>
// Use DataTableRowActions with smart defaults instead

// ❌ Wrong - Don't duplicate action button logic
// Use DataTableRowActions component for consistency
```

### Smart Defaults
- **Button style**: `variant="outline" size="sm" className="h-7"`
- **Icon size**: `h-3.5 w-3.5` (for smaller buttons)
- **Gap**: `gap-1` (small gap between buttons)
- **Layout**: `flex items-center justify-end`
- **Icons**: `Edit`, `Trash`, `Eye` from `lucide-react`

### Built-in Actions
- `onView` - Renders Eye icon button
- `onEdit` - Renders Edit icon button
- `onDelete` - Renders Trash icon button (with destructive styling)

### Custom Actions
Use `actions` array prop for custom actions:
- Each action requires: `id`, `icon`, `onClick`
- Optional: `label`, `variant`, `disabled` (boolean or function), `className`
- Actions render in order: Built-in (View → Edit → Delete) → Custom actions → Children

### AlertDialog Pattern
- AlertDialog state management stays in column hooks
- `onDelete` prop should trigger dialog open handler, not mutation directly
- AlertDialog component remains in cell render (not in DataTableRowActions)

### Reference Implementation
See:
- `src/components/common/data-table/data-table-row-actions.tsx` - Component implementation
- `src/features/academic-years/components/academicYearColumns.tsx` - Simple actions example
- `src/features/students/components/studentColumns.tsx` - Actions with AlertDialog example
