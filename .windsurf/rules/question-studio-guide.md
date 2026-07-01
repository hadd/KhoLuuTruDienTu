---
trigger: model_decision
description: Question Studio feature architecture and workspace-based UI patterns
globs:
---

# Question Studio Feature Architecture

This guide defines the **architectural blueprint** for the Question Studio feature. It focuses on structure, layout patterns, and technical constraints. Feature-specific logic will be planned separately.

## 1. Architectural Philosophy: "Workspace-based UI"

**Core Concept:** Question Studio uses a **"Workspace-based UI"** model rather than a traditional page-based navigation. The user operates within a persistent, full-screen environment where tools and panels adjust around the workflow.

**Data Flow Model:** "Source -> Target"

- **Left Pane (Source):** The Pool (Repositories, Search, Raw Materials).
- **Right Pane (Target):** The Worksheet (Composition, refinement, final product).

## 2. Directory Structure & Module Organization

Question Studio is a complex feature that functions as a standalone module. It is located in `src/features/question-studio/` to maintain separation of concerns.

```text
src/features/question-studio/
├── components/
│   ├── layout/
│   │   ├── StudioLayout.tsx      # Main shell (Split pane implementation)
│   │   ├── StudioHeader.tsx      # Global command center
│   │   └── Resizer.tsx           # Drag handle logic
│   ├── pool/ (Left Column)
│   │   ├── FilterBar.tsx         # Search & filtering container
│   │   ├── QuestionList.tsx      # Source material display
│   │   └── InlineEditor.tsx      # Quick creation panel
│   ├── worksheet/ (Right Column)
│   │   ├── WorksheetEditor.tsx   # Composition canvas
│   │   ├── BlockList.tsx         # Sortable question blocks
│   │   └── VariantTabs.tsx       # Version management
│   └── ai/
│       └── AIStudioModal.tsx     # AI generation interface
├── hooks/
│   ├── useStudioState.ts         # Layout & View mode logic
│   └── useWorksheet.ts           # Worksheet CRUD operations
├── types/
│   └── index.ts                  # Feature-specific types
└── stores/
    └── studio-store.ts           # Local UI state (Zustand/Context)
```

## 3. Layout & Routing Architecture

### Route Configuration

- **Path**: `/lessons/$lessonId/question-studio`
- **Parent**: `src/app/routes/lessons/$lessonId.tsx`
- **File**: `src/app/routes/lessons/$lessonId/question-studio.tsx`

### Layout Rules (CRITICAL)

1.  **No DashboardLayout**: This route controls its own full-screen viewport. It must **NOT** be wrapped in the standard `DashboardLayout`.
2.  **Full Height**: The root container must implement `h-screen` or `min-h-screen` with `overflow-hidden` to manage its own scrolling regions.
3.  **Back Navigation**: The Studio must provide its own navigation mechanism to return to the parent Lesson Detail context.

## 4. State Management Architecture

### Server State (React Query)

- Used for persistent data: Question Bank, Worksheet Content, Lesson Details.
- Mutations should optimistically update the UI where possible.

### Local UI State (Zustand / Context)

- **Layout State**: `viewMode` (Search/Split/Sheet), `paneSizes`.
- **Session State**: `activeSheetId`, `pinnedContext` (e.g., selected LO).
- **Transient State**: `isResizing`, `isAIModalOpen`.

### URL State

- **Minimal Syncing**: Only sync state that enables deep linking (sharing a specific view).
- **Example**: `?sheetId=xyz` (Active sheet), `?mode=split` (Layout preference).
- _Avoid syncing transient UI interactions to keep history clean._

## 5. Component Regions (High Level)

1.  **Header Region**:
    - Contains Navigation, Context Info, and Global Actions (Save, Publish).
2.  **Left Region (The Pool)**:
    - Dedicated to discovery and creation of raw questions.
    - Must support independent scrolling.
3.  **Right Region (The Worksheet)**:
    - Dedicated to composition and ordering.
    - Must support independent scrolling.
4.  **Overlay Region**:
    - Used for heavy tasks like AI Generation or Sheet Management that require focus.
    - Must use Portals to avoid z-index issues.

## 6. Integration Standards

- **i18n**: Use the `school` namespace for all feature-specific text.
- **Components**: Reuse UI primitives (`@/components/ui`) but implement custom styling for the workspace layout where necessary (e.g., custom scrollbars, splitters).
- **Error Handling**: Implement a Feature-level Error Boundary within `StudioLayout` to prevent crashing the entire app if a sub-component fails.

## 7. Question Editor (create/edit) — Save button

**Special behavior (do not change without reason):** The Save button in the question editor is **always enabled** except when a save is in progress. Validation runs **when the user clicks Save**; if validation fails (e.g. missing outcome, empty content), errors are shown via toast and form/field errors. The button is **not** disabled based on `form.state.isValid` or outcome selection, to avoid the button staying disabled after the user fixes content (e.g. stale errors on the `detail` field). See `QuestionEditor.tsx` footer comment and `QuestionEditorFooter` prop `disabled` JSDoc.

## 8. Question solution format

**AI workflow input (true_false):** Questions from the AI workflow use `question_type: "true_false"` with `multiple_choice_options` (array of `{ text, is_correct }` per statement) and `correct_answer_text` (display string in order, e.g. "Đúng, Sai", "Đúng, Sai, Đúng"). Statement index 0 corresponds to "a", 1 to "b", etc.

**Stored solution (API / editor):** For true_false, `solution.correctAnswers` is an array of **letters** of the **correct** statements only (same as multiple_choice): e.g. `["a"]` when only the first statement is correct, `["a", "c"]` when the first and third are correct. Parsing and display (practice, grading) use this format; practice derives "Đúng, Sai" per statement from `correctAnswers` plus question detail.
