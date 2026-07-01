import type {
  MetadataExportColumnConfigT,
  MetadataExportFieldCatalogItemT,
} from '@/features/data-config/types'

export const EXPORT_SEPARATOR_OPTIONS = [
  { value: ', ', labelKey: 'comma' as const },
  { value: ' ', labelKey: 'space' as const },
  { value: ' - ', labelKey: 'dash' as const },
  { value: '\n', labelKey: 'newline' as const },
]

export function createEmptyExportColumn(): MetadataExportColumnConfigT {
  return {
    header: '',
    fieldKeys: [],
    separator: ', ',
  }
}

export function fieldCatalogToGroups(
  catalog: Array<MetadataExportFieldCatalogItemT>,
): Array<{
  groupCode: string
  groupName: string
  fields: Array<MetadataExportFieldCatalogItemT>
}> {
  const byGroup = new Map<string, Array<MetadataExportFieldCatalogItemT>>()

  for (const item of catalog) {
    const existing = byGroup.get(item.groupCode) ?? []
    existing.push(item)
    byGroup.set(item.groupCode, existing)
  }

  return Array.from(byGroup.entries()).map(([groupCode, fields]) => ({
    groupCode,
    groupName: fields[0]?.groupName || groupCode,
    fields,
  }))
}

export function moveColumn(
  columns: Array<MetadataExportColumnConfigT>,
  fromIndex: number,
  toIndex: number,
): Array<MetadataExportColumnConfigT> {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= columns.length ||
    toIndex >= columns.length ||
    fromIndex === toIndex
  ) {
    return columns
  }

  const next = [...columns]
  const [item] = next.splice(fromIndex, 1)
  if (!item) return columns
  next.splice(toIndex, 0, item)
  return next
}

export function moveFieldInColumn(
  column: MetadataExportColumnConfigT,
  fromIndex: number,
  toIndex: number,
): MetadataExportColumnConfigT {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= column.fieldKeys.length ||
    toIndex >= column.fieldKeys.length ||
    fromIndex === toIndex
  ) {
    return column
  }

  const fieldKeys = [...column.fieldKeys]
  const [item] = fieldKeys.splice(fromIndex, 1)
  if (!item) return column
  fieldKeys.splice(toIndex, 0, item)
  return { ...column, fieldKeys }
}

export function toggleFieldInColumn(
  column: MetadataExportColumnConfigT,
  fieldKey: string,
  checked: boolean,
): MetadataExportColumnConfigT {
  const without = column.fieldKeys.filter((key) => key !== fieldKey)
  if (!checked) {
    return { ...column, fieldKeys: without }
  }
  return { ...column, fieldKeys: [...without, fieldKey] }
}

export function isFieldAssignedToOtherColumn(
  columns: Array<MetadataExportColumnConfigT>,
  columnIndex: number,
  fieldKey: string,
): boolean {
  return columns.some(
    (column, index) =>
      index !== columnIndex && column.fieldKeys.includes(fieldKey),
  )
}

/** Gán trường vào một cột; mỗi trường chỉ thuộc tối đa một cột. */
export function toggleFieldAcrossColumns(
  columns: Array<MetadataExportColumnConfigT>,
  columnIndex: number,
  fieldKey: string,
  checked: boolean,
): Array<MetadataExportColumnConfigT> {
  if (!checked) {
    return columns.map((column, index) =>
      index === columnIndex
        ? toggleFieldInColumn(column, fieldKey, false)
        : column,
    )
  }

  return columns.map((column, index) => {
    const withoutField = {
      ...column,
      fieldKeys: column.fieldKeys.filter((key) => key !== fieldKey),
    }
    if (index === columnIndex) {
      return {
        ...withoutField,
        fieldKeys: [...withoutField.fieldKeys, fieldKey],
      }
    }
    return withoutField
  })
}

export function canExportWithPreset(
  selectedPresetId: string,
  columns: Array<MetadataExportColumnConfigT>,
): boolean {
  if (selectedPresetId !== 'custom') {
    return Boolean(selectedPresetId)
  }
  return isExportColumnsReady(columns)
}

export function isExportColumnsReady(
  columns: Array<MetadataExportColumnConfigT>,
): boolean {
  return (
    columns.length > 0 &&
    columns.every(
      (column) =>
        column.header.trim().length > 0 && column.fieldKeys.length > 0,
    )
  )
}

export type MetadataExportColumnFieldError =
  | 'missingHeader'
  | 'missingFields'
  | 'duplicateHeader'

export type MetadataExportColumnErrors = Partial<
  Record<number, Partial<Record<MetadataExportColumnFieldError, true>>>
>

export type MetadataExportValidationIssue =
  | { code: 'noColumns' }
  | { code: 'missingName' }
  | { code: 'missingHeader'; columnIndex: number }
  | { code: 'missingFields'; columnIndex: number }
  | { code: 'duplicateHeader'; columnIndex: number; header: string }

export interface MetadataExportValidationResult {
  issues: Array<MetadataExportValidationIssue>
  columnErrors: MetadataExportColumnErrors
}

export function validateExportColumnsConfig(
  columns: Array<MetadataExportColumnConfigT>,
  options: { requireFields?: boolean } = { requireFields: true },
): MetadataExportValidationResult {
  const issues: Array<MetadataExportValidationIssue> = []
  const columnErrors: MetadataExportColumnErrors = {}
  const headers = new Set<string>()

  if (columns.length === 0) {
    issues.push({ code: 'noColumns' })
    return { issues, columnErrors }
  }

  columns.forEach((column, columnIndex) => {
    const header = column.header.trim()
    const columnIssue: Partial<Record<MetadataExportColumnFieldError, true>> =
      {}

    if (!header) {
      issues.push({ code: 'missingHeader', columnIndex })
      columnIssue.missingHeader = true
    } else if (headers.has(header)) {
      issues.push({ code: 'duplicateHeader', columnIndex, header })
      columnIssue.duplicateHeader = true
    } else {
      headers.add(header)
    }

    if (options.requireFields && column.fieldKeys.length === 0) {
      issues.push({ code: 'missingFields', columnIndex })
      columnIssue.missingFields = true
    }

    if (Object.keys(columnIssue).length > 0) {
      columnErrors[columnIndex] = columnIssue
    }
  })

  return { issues, columnErrors }
}

export function focusExportColumnIssue(
  columnIndex: number,
  focus: MetadataExportColumnFieldError = 'missingHeader',
) {
  window.setTimeout(() => {
    const columnEl = document.querySelector(
      `[data-export-column-index="${columnIndex}"]`,
    )
    columnEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    if (focus === 'missingHeader') {
      columnEl
        ?.querySelector<HTMLInputElement>('[data-export-column-header]')
        ?.focus()
      return
    }

    columnEl
      ?.querySelector<HTMLElement>('[data-export-column-fields]')
      ?.focus()
  }, 0)
}

export function focusExportPresetName() {
  window.setTimeout(() => {
    const nameInput = document.querySelector<HTMLInputElement>(
      '[data-export-preset-name]',
    )
    nameInput?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    nameInput?.focus()
  }, 0)
}

export function getExportColumnValidationMessage(
  t: (key: string, options?: Record<string, unknown>) => string,
  issue: MetadataExportValidationIssue,
): string {
  switch (issue.code) {
    case 'noColumns':
      return t('metadataExport.validation.noColumns')
    case 'missingName':
      return t('metadataExport.validation.missingName')
    case 'missingHeader':
      return t('metadataExport.validation.missingHeader', {
        column: issue.columnIndex + 1,
      })
    case 'missingFields':
      return t('metadataExport.validation.missingFields', {
        column: issue.columnIndex + 1,
      })
    case 'duplicateHeader':
      return t('metadataExport.validation.duplicateHeader', {
        column: issue.columnIndex + 1,
        header: issue.header,
      })
  }
}

export function focusFirstExportColumnIssue(
  issue: MetadataExportValidationIssue,
) {
  if (issue.code === 'missingName') {
    focusExportPresetName()
    return
  }

  if (issue.code === 'missingHeader' || issue.code === 'duplicateHeader') {
    focusExportColumnIssue(issue.columnIndex, 'missingHeader')
    return
  }

  if (issue.code === 'missingFields') {
    focusExportColumnIssue(issue.columnIndex, 'missingFields')
  }
}

export function fieldLabel(
  catalog: Array<MetadataExportFieldCatalogItemT>,
  fieldKey: string,
): string {
  const item = catalog.find((entry) => entry.key === fieldKey)
  if (!item) return fieldKey
  const display = item.display.trim()
  return display || item.fieldName
}

export function buildStructuralExportPreview(
  columns: Array<MetadataExportColumnConfigT>,
  fieldCatalog: Array<MetadataExportFieldCatalogItemT>,
): {
  headers: string[]
  rows: Array<{ rowLabel: string; cells: Array<string> }>
  totalCount: number
  previewCount: number
} {
  const headers = columns.map((_, index) => String(index + 1))
  const headerCells = columns.map((column) => column.header.trim() || '—')
  const fieldCells = columns.map((column) =>
    column.fieldKeys
      .map((fieldKey) => fieldLabel(fieldCatalog, fieldKey))
      .join(column.separator),
  )

  return {
    headers,
    rows: [
      { rowLabel: 'headerRow', cells: headerCells },
      { rowLabel: 'fieldsRow', cells: fieldCells },
    ],
    totalCount: 1,
    previewCount: 1,
  }
}
