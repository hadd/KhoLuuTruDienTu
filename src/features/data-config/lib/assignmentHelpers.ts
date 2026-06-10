import type { MetadataSchemaGroupT } from '@/features/group/types'

export type GroupCheckState = 'checked' | 'indeterminate' | 'unchecked'

function isWildcardPattern(pattern: string): boolean {
  return pattern.endsWith('.*')
}

export function isFieldAllowed(
  fieldKey: string,
  allowedFields: Array<string>,
): boolean {
  return allowedFields.some((pattern) => {
    if (isWildcardPattern(pattern)) {
      const prefix = pattern.slice(0, -2)
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

  if (!checked) {
    const withoutGroup = removeGroupPatterns(allowedFields, groupCode)
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

  if (isFieldAllowed(fieldKey, allowedFields)) {
    return allowedFields
  }

  const withoutWildcard = allowedFields.filter(
    (pattern) => pattern !== `${groupCode}.*`,
  )
  const nextFields = [...withoutWildcard, fieldKey]

  if (!group) return nextFields

  const allSelected = group.fields.every((field) =>
    isFieldAllowed(field.key, nextFields),
  )

  if (allSelected) {
    const withoutGroup = removeGroupPatterns(withoutWildcard, groupCode)
    return [...withoutGroup, `${group.groupCode}.*`]
  }

  return nextFields
}
