import type { ArchiveFieldConfigT } from '@/features/archive-config/types'

export function formatArchiveFieldDisplay(
  field: ArchiveFieldConfigT,
  value: unknown,
  resolvedLabels?: Record<string, { id: string; label: string }>,
): string {
  if (value == null || value === '') {
    return '—'
  }

  if (field.fieldType === 'REFERENCE') {
    const resolved = resolvedLabels?.[field.fieldKey]
    if (resolved && String(value) === resolved.id) {
      return resolved.label
    }
    return String(value)
  }

  if (field.fieldType === 'SELECT') {
    const option = field.options.find((item) => item.value === String(value))
    return option?.label ?? String(value)
  }

  return String(value)
}
