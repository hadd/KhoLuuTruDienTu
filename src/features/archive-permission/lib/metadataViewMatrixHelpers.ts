import {
  isFieldAllowed,
  toggleField,
  toggleGroupFields,
} from '@/features/data-config/lib/assignmentHelpers'
import type { MetadataSchemaGroupT } from '@/features/group/types'

export function isFieldCheckedInSlot(
  fieldKey: string,
  fieldKeys: Array<string>,
): boolean {
  return isFieldAllowed(fieldKey, fieldKeys)
}

export function isGroupCheckedInSlot(
  group: MetadataSchemaGroupT,
  fieldKeys: Array<string>,
): boolean {
  return fieldKeys.includes(`${group.groupCode}.*`)
}

export function toggleFieldInSlot(
  fieldKey: string,
  slotCode: string,
  checked: boolean,
  slots: Array<{ slotCode: string; fieldKeys: Array<string> }>,
  schema: Array<MetadataSchemaGroupT>,
): Array<{ slotCode: string; fieldKeys: Array<string> }> {
  return slots.map((slot) => {
    if (slot.slotCode !== slotCode) return slot
    return {
      ...slot,
      fieldKeys: toggleField(fieldKey, slot.fieldKeys, checked, schema),
    }
  })
}

export function toggleGroupInSlot(
  group: MetadataSchemaGroupT,
  slotCode: string,
  checked: boolean,
  slots: Array<{ slotCode: string; fieldKeys: Array<string> }>,
): Array<{ slotCode: string; fieldKeys: Array<string> }> {
  return slots.map((slot) => {
    if (slot.slotCode !== slotCode) return slot
    return {
      ...slot,
      fieldKeys: toggleGroupFields(group, slot.fieldKeys, checked),
    }
  })
}
