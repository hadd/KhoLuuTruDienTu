import type { MetadataSchemaGroupT } from '@/features/group/types'

export type GroupCheckState = 'checked' | 'indeterminate' | 'unchecked'

export function normalizeAllowedFields(value: unknown): Array<string> {
  return Array.isArray(value) ? value : []
}

function isWildcardPattern(pattern: string): boolean {
  return pattern.endsWith('.*')
}

function getWildcardPrefix(pattern: string): string {
  return pattern.slice(0, -2)
}

export function isFieldAllowed(
  fieldKey: string,
  allowedFields: Array<string>,
): boolean {
  return allowedFields.some((pattern) => {
    if (isWildcardPattern(pattern)) {
      const prefix = getWildcardPrefix(pattern)
      return fieldKey.startsWith(`${prefix}.`) || fieldKey === prefix
    }
    return fieldKey === pattern
  })
}

export function getGroupCheckState(
  group: MetadataSchemaGroupT,
  allowedFields: Array<string>,
): GroupCheckState {
  if (group.fields.length === 0) return 'unchecked'

  const allowedCount = group.fields.filter((field) =>
    isFieldAllowed(field.key, allowedFields),
  ).length

  if (allowedCount === 0) return 'unchecked'
  if (allowedCount === group.fields.length) return 'checked'
  return 'indeterminate'
}

function removeGroupPatterns(
  allowedFields: Array<string>,
  groupCode: string,
): Array<string> {
  return allowedFields.filter((pattern) => {
    if (pattern === `${groupCode}.*`) return false
    if (pattern.startsWith(`${groupCode}.`)) return false
    return true
  })
}

export function toggleGroupFields(
  group: MetadataSchemaGroupT,
  allowedFields: Array<string>,
  checked: boolean,
): Array<string> {
  const withoutGroup = removeGroupPatterns(allowedFields, group.groupCode)

  if (!checked) return withoutGroup

  return [...withoutGroup, `${group.groupCode}.*`]
}

export function toggleField(
  fieldKey: string,
  allowedFields: Array<string>,
  checked: boolean,
  schema: Array<MetadataSchemaGroupT>,
): Array<string> {
  const groupCode = fieldKey.split('.')[0]
  const group = schema.find((item) => item.groupCode === groupCode)
  const withoutGroup = removeGroupPatterns(allowedFields, groupCode)

  if (!checked) {
    const remaining = withoutGroup.filter((pattern) => {
      if (isWildcardPattern(pattern)) return true
      return pattern !== fieldKey
    })

    if (!group) return remaining

    const explicitFields = group.fields
      .filter(
        (field) =>
          field.key !== fieldKey && isFieldAllowed(field.key, allowedFields),
      )
      .map((field) => field.key)

    return [...remaining, ...explicitFields]
  }

  const nextFields = [...withoutGroup, fieldKey]
  if (!group) return nextFields

  const allSelected = group.fields.every((field) =>
    isFieldAllowed(field.key, nextFields),
  )

  if (allSelected) {
    return toggleGroupFields(group, allowedFields, true)
  }

  return nextFields
}

export function compressAllowedFields(
  selectedKeys: Array<string>,
  schema: Array<MetadataSchemaGroupT>,
): Array<string> {
  const result: Array<string> = []
  const usedGroups = new Set<string>()

  for (const group of schema) {
    const allSelected = group.fields.every((field) =>
      isFieldAllowed(field.key, selectedKeys),
    )

    if (allSelected && group.fields.length > 0) {
      result.push(`${group.groupCode}.*`)
      usedGroups.add(group.groupCode)
    }
  }

  for (const key of selectedKeys) {
    const groupCode = key.split('.')[0]
    if (usedGroups.has(groupCode)) continue

    const isExplicitKey = schema.some((group) =>
      group.fields.some((field) => field.key === key),
    )

    if (isExplicitKey && !result.includes(key)) {
      result.push(key)
    }
  }

  return result
}

export function expandAllowedFieldsToKeys(
  allowedFields: Array<string>,
  schema: Array<MetadataSchemaGroupT>,
): Array<string> {
  const keys = new Set<string>()

  for (const pattern of allowedFields) {
    if (isWildcardPattern(pattern)) {
      const prefix = getWildcardPrefix(pattern)
      const group = schema.find((item) => item.groupCode === prefix)
      if (group) {
        group.fields.forEach((field) => keys.add(field.key))
      }
      continue
    }

    keys.add(pattern)
  }

  return Array.from(keys)
}

export interface AssignedGroupLabelT {
  groupCode: string
  groupName: string
  fieldDisplays: Array<string>
}

export function getAllSchemaFieldKeys(
  schema: Array<MetadataSchemaGroupT>,
): Array<string> {
  return schema.flatMap((group) => group.fields.map((field) => field.key))
}

export function getAssignedFieldKeysAcrossEditors(
  assignments: Record<string, Array<string>>,
  schema: Array<MetadataSchemaGroupT>,
): Set<string> {
  const keys = new Set<string>()

  for (const patterns of Object.values(assignments)) {
    expandAllowedFieldsToKeys(patterns, schema).forEach((key) => keys.add(key))
  }

  return keys
}

export function isAssignmentComplete(
  assignments: Record<string, Array<string>>,
  schema: Array<MetadataSchemaGroupT>,
): boolean {
  const allKeys = getAllSchemaFieldKeys(schema)
  if (allKeys.length === 0) return false

  const assigned = new Set<string>()

  for (const patterns of Object.values(assignments)) {
    for (const key of expandAllowedFieldsToKeys(patterns, schema)) {
      if (assigned.has(key)) return false
      assigned.add(key)
    }
  }

  return allKeys.every((key) => assigned.has(key))
}

export function getClaimedFieldKeysByOthers(
  assignments: Record<string, Array<string>>,
  schema: Array<MetadataSchemaGroupT>,
  excludeEditorId: string,
): Set<string> {
  const claimed = new Set<string>()

  for (const [editorId, patterns] of Object.entries(assignments)) {
    if (editorId === excludeEditorId) continue
    expandAllowedFieldsToKeys(patterns, schema).forEach((key) => claimed.add(key))
  }

  return claimed
}

export function buildClaimedFieldOwners(
  assignments: Record<string, Array<string>>,
  schema: Array<MetadataSchemaGroupT>,
  editors: Array<{ editorId: string; fullName: string }>,
  excludeEditorId: string,
): Map<string, string> {
  const owners = new Map<string, string>()

  for (const editor of editors) {
    if (editor.editorId === excludeEditorId) continue

    const keys = expandAllowedFieldsToKeys(
      assignments[editor.editorId] ?? [],
      schema,
    )

    for (const key of keys) {
      owners.set(key, editor.fullName)
    }
  }

  return owners
}

export function getExclusiveGroupCheckState(
  group: MetadataSchemaGroupT,
  allowedFields: Array<string>,
  claimedByOthers: Set<string>,
): GroupCheckState {
  const selectableFields = group.fields.filter(
    (field) => !claimedByOthers.has(field.key),
  )

  if (selectableFields.length === 0) return 'unchecked'

  const assignedCount = selectableFields.filter((field) =>
    isFieldAllowed(field.key, allowedFields),
  ).length

  if (assignedCount === 0) return 'unchecked'
  if (assignedCount === selectableFields.length) return 'checked'
  return 'indeterminate'
}

export function toggleFieldExclusive(
  fieldKey: string,
  allowedFields: Array<string>,
  checked: boolean,
  schema: Array<MetadataSchemaGroupT>,
  claimedByOthers: Set<string>,
): Array<string> {
  if (checked && claimedByOthers.has(fieldKey)) {
    return allowedFields
  }

  return toggleField(fieldKey, allowedFields, checked, schema)
}

export function toggleGroupFieldsExclusive(
  group: MetadataSchemaGroupT,
  allowedFields: Array<string>,
  checked: boolean,
  schema: Array<MetadataSchemaGroupT>,
  claimedByOthers: Set<string>,
): Array<string> {
  if (!checked) {
    return toggleGroupFields(group, allowedFields, false)
  }

  const withoutGroup = removeGroupPatterns(allowedFields, group.groupCode)
  const availableKeys = group.fields
    .filter((field) => !claimedByOthers.has(field.key))
    .map((field) => field.key)

  if (availableKeys.length === 0) return withoutGroup

  const nextKeys = [
    ...expandAllowedFieldsToKeys(withoutGroup, schema),
    ...availableKeys,
  ]

  return compressAllowedFields(nextKeys, schema)
}

export function resolveAssignedGroupLabels(
  allowedFields: Array<string>,
  schema: Array<MetadataSchemaGroupT>,
): Array<AssignedGroupLabelT> {
  if (allowedFields.length === 0) return []

  return schema
    .map((group) => {
      const fieldDisplays = group.fields
        .filter((field) => isFieldAllowed(field.key, allowedFields))
        .map((field) => field.display)

      if (fieldDisplays.length === 0) return null

      return {
        groupCode: group.groupCode,
        groupName: group.groupName,
        fieldDisplays,
      }
    })
    .filter((item): item is AssignedGroupLabelT => item !== null)
}
