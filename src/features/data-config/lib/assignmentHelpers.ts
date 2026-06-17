import type { MetadataSchemaGroupT } from '@/features/group/types'

function isWildcardPattern(pattern: string): boolean {  return pattern.endsWith('.*')
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

export function getFieldAssignedSlotCode(
  fieldKey: string,
  slots: Array<{ slotCode: string; fieldKeys: Array<string> }>,
): string | null {
  for (const slot of slots) {
    if (isFieldAllowed(fieldKey, slot.fieldKeys)) {
      return slot.slotCode
    }
  }
  return null
}

export function getGroupAssignedSlotCode(
  group: MetadataSchemaGroupT,
  slots: Array<{ slotCode: string; fieldKeys: Array<string> }>,
): string | null {
  const wildcard = `${group.groupCode}.*`
  const wildcardSlot = slots.find((slot) => slot.fieldKeys.includes(wildcard))
  if (wildcardSlot) return wildcardSlot.slotCode

  const assignedSlots = group.fields
    .map((field) => getFieldAssignedSlotCode(field.key, slots))
    .filter((slotCode): slotCode is string => Boolean(slotCode))

  const uniqueSlots = new Set(assignedSlots)
  if (uniqueSlots.size === 1) {
    return assignedSlots[0] ?? null
  }

  return null
}

export function assignFieldToSlot(
  fieldKey: string,
  targetSlotCode: string,
  slots: Array<{ slotCode: string; fieldKeys: Array<string> }>,
  schema: Array<MetadataSchemaGroupT>,
): Array<{ slotCode: string; fieldKeys: Array<string> }> {
  return slots.map((slot) => {
    const withoutField = toggleField(fieldKey, slot.fieldKeys, false, schema)
    if (slot.slotCode !== targetSlotCode) {
      return { ...slot, fieldKeys: withoutField }
    }

    return {
      ...slot,
      fieldKeys: toggleField(fieldKey, withoutField, true, schema),
    }
  })
}

export function assignGroupToSlot(
  group: MetadataSchemaGroupT,
  targetSlotCode: string,
  slots: Array<{ slotCode: string; fieldKeys: Array<string> }>,
): Array<{ slotCode: string; fieldKeys: Array<string> }> {
  return slots.map((slot) => {
    const withoutGroup = removeGroupPatterns(slot.fieldKeys, group.groupCode)
    if (slot.slotCode !== targetSlotCode) {
      return { ...slot, fieldKeys: withoutGroup }
    }

    return {
      ...slot,
      fieldKeys: toggleGroupFields(group, withoutGroup, true),
    }
  })
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
