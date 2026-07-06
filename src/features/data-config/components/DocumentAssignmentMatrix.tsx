import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  assignFieldToSlot,
  assignGroupToSlot,
  getFieldAssignedSlotCode,
  getGroupAssignedSlotCode,
} from '@/features/data-config/lib/assignmentHelpers'
import type { MetadataPermissionSlotT } from '@/features/data-config/types'
import type { MetadataSchemaGroupT } from '@/features/group/types'
import { cn } from '@/lib/utils/cn'

interface AssignmentRadioProps {
  checked: boolean
  disabled?: boolean
  onSelect: () => void
  ariaLabel: string
}

function AssignmentRadio({
  checked,
  disabled = false,
  onSelect,
  ariaLabel,
}: AssignmentRadioProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center rounded-full p-0',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'size-5 rounded-full border-2 transition-colors',
          checked
            ? 'border-blue-600 bg-blue-500'
            : 'border-primary bg-background hover:bg-accent/40',
        )}
      />
    </button>
  )
}

interface DocumentAssignmentMatrixProps {
  schema: Array<MetadataSchemaGroupT>
  slots: Array<MetadataPermissionSlotT>
  isLoading?: boolean
  disabled?: boolean
  onSlotsChange: (nextSlots: Array<MetadataPermissionSlotT>) => void
  onAddSlot: () => void
  onRenameSlot: (slot: MetadataPermissionSlotT) => void
  onDeleteSlot: (slot: MetadataPermissionSlotT) => void
}

export function DocumentAssignmentMatrix({
  schema,
  slots,
  isLoading = false,
  disabled = false,
  onSlotsChange,
  onAddSlot,
  onRenameSlot,
  onDeleteSlot,
}: DocumentAssignmentMatrixProps) {
  const { t } = useTranslation('data-config')

  const handleAssignField = (fieldKey: string, slotCode: string) => {
    const nextSlots = assignFieldToSlot(fieldKey, slotCode, slots, schema)
    onSlotsChange(
      nextSlots.map((slot, index) => ({
        ...slots[index],
        fieldKeys: slot.fieldKeys,
      })),
    )
  }

  const handleAssignGroup = (group: MetadataSchemaGroupT, slotCode: string) => {
    const nextSlots = assignGroupToSlot(group, slotCode, slots)
    onSlotsChange(
      nextSlots.map((slot, index) => ({
        ...slots[index],
        fieldKeys: slot.fieldKeys,
      })),
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (schema.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          {t('documentAssignment.empty.noFields')}
        </p>
      </div>
    )
  }

  const slotColumnMinWidth = '10rem'
  const hasSlots = slots.length > 0

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {!hasSlots ? (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
          <p className="text-sm text-muted-foreground">
            {t('documentAssignment.slots.empty')}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onAddSlot}>
            <Plus className="size-4" />
            {t('documentAssignment.slots.add')}
          </Button>
        </div>
      ) : null}
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border">
            <th
              scope="col"
              className="min-w-[14rem] border-r border-border bg-card px-4 py-3 text-left font-medium text-foreground"
            >
              {t('documentAssignment.columns.documentName')}
            </th>
            {slots.map((slot, index) => (
              <th
                key={slot.slotCode}
                scope="col"
                style={{ minWidth: slotColumnMinWidth }}
                className={cn(
                  'border-r border-border px-4 py-3 text-center font-medium text-foreground last:border-r-0',
                  index === 0 && 'bg-primary/5',
                )}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="truncate">{slot.slotName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    disabled={disabled}
                    onClick={() => onRenameSlot(slot)}
                    aria-label={t('documentAssignment.slots.rename')}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={disabled}
                    onClick={() => onDeleteSlot(slot)}
                    aria-label={t('documentAssignment.slots.remove')}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </th>
            ))}
            {hasSlots ? (
              <th
                scope="col"
                style={{ minWidth: slotColumnMinWidth }}
                className="px-3 py-2 text-center"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-primary"
                  disabled={disabled}
                  onClick={onAddSlot}
                  aria-label={t('documentAssignment.slots.add')}
                >
                  <Plus className="size-4" />
                </Button>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {schema.map((group) => {
            const groupSlotCode = getGroupAssignedSlotCode(group, slots)

            return (
              <GroupRows
                key={group.groupCode}
                group={group}
                slots={slots}
                groupSlotCode={groupSlotCode}
                disabled={disabled}
                onAssignGroup={(slotCode) => handleAssignGroup(group, slotCode)}
                onAssignField={handleAssignField}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface GroupRowsProps {
  group: MetadataSchemaGroupT
  slots: Array<MetadataPermissionSlotT>
  groupSlotCode: string | null
  disabled: boolean
  onAssignGroup: (slotCode: string) => void
  onAssignField: (fieldKey: string, slotCode: string) => void
}

function GroupRows({
  group,
  slots,
  groupSlotCode,
  disabled,
  onAssignGroup,
  onAssignField,
}: GroupRowsProps) {
  const { t } = useTranslation('data-config')
  const hasSlots = slots.length > 0

  return (
    <>
      <tr className="border-b border-border bg-muted/50">
        <td className="border-r border-border bg-muted/50 px-4 py-2.5">
          <span className="pl-4 font-semibold text-foreground">
            {group.groupName}
          </span>
        </td>
        {hasSlots
          ? slots.map((slot) => (
              <td
                key={`group-${group.groupCode}-${slot.slotCode}`}
                className="border-r border-border bg-muted/50 px-3 py-2.5 text-center last:border-r-0"
              >
                <AssignmentRadio
                  checked={groupSlotCode === slot.slotCode}
                  disabled={disabled}
                  onSelect={() => onAssignGroup(slot.slotCode)}
                  ariaLabel={t('documentAssignment.matrix.assignGroup', {
                    group: group.groupName,
                    slot: slot.slotName,
                  })}
                />
              </td>
            ))
          : null}
        {hasSlots ? <td className="bg-muted/50 px-3 py-2.5" /> : null}
      </tr>

      {group.fields.map((field) => {
        const fieldSlotCode = getFieldAssignedSlotCode(field.key, slots)

        return (
          <tr key={field.key} className="border-b border-border">
            <td className="border-r border-border px-4 py-2.5">
              <span className="pl-8 text-muted-foreground">
                {field.display}
              </span>
            </td>
            {hasSlots
              ? slots.map((slot, index) => (
                  <td
                    key={`field-${field.key}-${slot.slotCode}`}
                    className={cn(
                      'border-r border-border px-3 py-2.5 text-center last:border-r-0',
                      index === 0 && 'bg-primary/5',
                    )}
                  >
                    <AssignmentRadio
                      checked={fieldSlotCode === slot.slotCode}
                      disabled={disabled}
                      onSelect={() => onAssignField(field.key, slot.slotCode)}
                      ariaLabel={t('documentAssignment.matrix.assignField', {
                        field: field.display,
                        slot: slot.slotName,
                      })}
                    />
                  </td>
                ))
              : null}
            {hasSlots ? <td className="px-3 py-2.5" /> : null}
          </tr>
        )
      })}
    </>
  )
}
