import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { ScanPageThumbnail } from '@/features/document-scan/components/ScanPageThumbnail'
import type { ScanPageT } from '@/features/document-scan/types'

interface ScanPageReorderListProps {
  pages: Array<ScanPageT>
  selectedPageId?: string
  onSelectPage: (pageId: string) => void
  onDeletePage: (pageId: string) => void
  onReorder: (orderedPageIds: Array<string>) => void
}

function SortableScanPageThumbnail({
  page,
  selectedPageId,
  onSelectPage,
  onDeletePage,
}: {
  page: ScanPageT
  selectedPageId?: string
  onSelectPage: (pageId: string) => void
  onDeletePage: (pageId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ScanPageThumbnail
        page={page}
        isSelected={selectedPageId === page.id}
        dragHandleProps={{ ...attributes, ...listeners }}
        onSelect={onSelectPage}
        onDelete={onDeletePage}
      />
    </div>
  )
}

export function ScanPageReorderList({
  pages,
  selectedPageId,
  onSelectPage,
  onDeletePage,
  onReorder,
}: ScanPageReorderListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = pages.findIndex((page) => page.id === active.id)
    const newIndex = pages.findIndex((page) => page.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(pages, oldIndex, newIndex)
    onReorder(reordered.map((page) => page.id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={pages.map((page) => page.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {pages.map((page) => (
            <SortableScanPageThumbnail
              key={page.id}
              page={page}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              onDeletePage={onDeletePage}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
