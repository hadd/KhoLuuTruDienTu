import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type {
  ArchiveAclPrincipalT,
  ArchiveMetadataViewGroupT,
  ArchiveMetadataViewSlotT,
} from '@/features/archive-permission/api/archiveAclClient'
import {
  isFieldCheckedInSlot,
  isGroupCheckedInSlot,
  toggleFieldInSlot,
  toggleGroupInSlot,
} from '@/features/archive-permission/lib/metadataViewMatrixHelpers'
import type { MetadataSchemaGroupT } from '@/features/group/types'
import { cn } from '@/lib/utils/cn'

function toSchemaGroups(
  groups: Array<ArchiveMetadataViewGroupT>,
): Array<MetadataSchemaGroupT> {
  return groups.map((g) => ({
    groupCode: g.groupCode,
    groupName: g.groupName,
    isDynamic: false,
    fields: g.fields.map((f) => ({
      key: f.key,
      name: f.name,
      display: f.display,
    })),
  }))
}

type ArchiveMetadataViewMatrixProps = {
  groups: Array<ArchiveMetadataViewGroupT>
  slots: Array<ArchiveMetadataViewSlotT>
  isLoading?: boolean
  disabled?: boolean
  nameByPrincipal: Map<string, string>
  onSlotsChange: (nextSlots: Array<ArchiveMetadataViewSlotT>) => void
  onEditSlotPrincipals: (slot: ArchiveMetadataViewSlotT) => void
  onAddColumn: () => void
  onDeleteSlot: (slot: ArchiveMetadataViewSlotT) => void
}

export function ArchiveMetadataViewMatrix({
  groups,
  slots,
  isLoading = false,
  disabled = false,
  nameByPrincipal,
  onSlotsChange,
  onEditSlotPrincipals,
  onAddColumn,
  onDeleteSlot,
}: ArchiveMetadataViewMatrixProps) {
  const { t } = useTranslation('archive-permission')
  const schema = toSchemaGroups(groups)

  const handleToggleField = (
    fieldKey: string,
    slotCode: string,
    checked: boolean,
  ) => {
    const nextSlots = toggleFieldInSlot(
      fieldKey,
      slotCode,
      checked,
      slots,
      schema,
    )
    onSlotsChange(
      nextSlots.map((slot, index) => ({
        ...slots[index]!,
        fieldKeys: slot.fieldKeys,
      })),
    )
  }

  const handleToggleGroup = (
    group: MetadataSchemaGroupT,
    slotCode: string,
    checked: boolean,
  ) => {
    const nextSlots = toggleGroupInSlot(group, slotCode, checked, slots)
    onSlotsChange(
      nextSlots.map((slot, index) => ({
        ...slots[index]!,
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

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          {t('acl.metadataView.emptyNoFields')}
        </p>
      </div>
    )
  }

  const slotColumnMinWidth = '10rem'
  const hasSlots = slots.length > 0

  function formatPrincipalLabel(p: ArchiveAclPrincipalT): string {
    return nameByPrincipal.get(`${p.kind}:${p.id}`) ?? p.id
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {!hasSlots ? (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
          <p className="text-sm text-muted-foreground">
            {t('acl.metadataView.emptyNoColumns')}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onAddColumn}>
            <Plus className="size-4" />
            {t('acl.metadataView.addColumn')}
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
              {t('acl.metadataView.columnField')}
            </th>
            {slots.map((slot, index) => (
              <th
                key={slot.slotCode}
                scope="col"
                style={{ minWidth: slotColumnMinWidth }}
                className={cn(
                  'border-r border-border px-3 py-2 text-center font-medium text-foreground last:border-r-0',
                  index === 0 && 'bg-primary/5',
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {slot.principals.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {t('acl.noPrincipals')}
                      </span>
                    ) : (
                      slot.principals.map((p) => (
                        <span
                          key={`${p.kind}:${p.id}`}
                          className="max-w-[8rem] truncate rounded-md border px-1.5 py-0.5 text-xs"
                        >
                          {formatPrincipalLabel(p)}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground"
                      disabled={disabled}
                      onClick={() => onEditSlotPrincipals(slot)}
                      aria-label={t('acl.addPrincipals')}
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
                      aria-label={t('acl.metadataView.removeColumn')}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
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
                  size="sm"
                  className="gap-1 text-primary"
                  disabled={disabled}
                  onClick={onAddColumn}
                >
                  <Plus className="size-4" />
                  {t('acl.metadataView.addColumn')}
                </Button>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {schema.map((group) => (
            <GroupRows
              key={group.groupCode}
              group={group}
              slots={slots}
              disabled={disabled}
              onToggleGroup={(slotCode, checked) =>
                handleToggleGroup(group, slotCode, checked)
              }
              onToggleField={(fieldKey, slotCode, checked) =>
                handleToggleField(fieldKey, slotCode, checked)
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

type GroupRowsProps = {
  group: MetadataSchemaGroupT
  slots: Array<ArchiveMetadataViewSlotT>
  disabled: boolean
  onToggleGroup: (slotCode: string, checked: boolean) => void
  onToggleField: (
    fieldKey: string,
    slotCode: string,
    checked: boolean,
  ) => void
}

function GroupRows({
  group,
  slots,
  disabled,
  onToggleGroup,
  onToggleField,
}: GroupRowsProps) {
  const { t } = useTranslation('archive-permission')
  const hasSlots = slots.length > 0

  return (
    <>
      <tr className="border-b border-border bg-muted/50">
        <td className="border-r border-border bg-muted/50 px-4 py-2.5">
          <span className="pl-4 font-semibold text-foreground">
            ▶ {group.groupName}
          </span>
        </td>
        {hasSlots
          ? slots.map((slot) => (
              <td
                key={`group-${group.groupCode}-${slot.slotCode}`}
                className="border-r border-border bg-muted/50 px-3 py-2.5 text-center last:border-r-0"
              >
                <Checkbox
                  checked={isGroupCheckedInSlot(group, slot.fieldKeys)}
                  disabled={disabled}
                  aria-label={t('acl.metadataView.assignGroup', {
                    group: group.groupName,
                    column: slot.slotCode,
                  })}
                  onCheckedChange={(value) =>
                    onToggleGroup(slot.slotCode, value === true)
                  }
                />
              </td>
            ))
          : null}
        {hasSlots ? <td className="bg-muted/50 px-3 py-2.5" /> : null}
      </tr>

      {group.fields.map((field) => (
        <tr key={field.key} className="border-b border-border">
          <td className="border-r border-border px-4 py-2.5">
            <span className="pl-8 text-muted-foreground">{field.display}</span>
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
                  <Checkbox
                    checked={isFieldCheckedInSlot(field.key, slot.fieldKeys)}
                    disabled={disabled}
                    aria-label={t('acl.metadataView.assignField', {
                      field: field.display,
                      column: slot.slotCode,
                    })}
                    onCheckedChange={(value) =>
                      onToggleField(field.key, slot.slotCode, value === true)
                    }
                  />
                </td>
              ))
            : null}
          {hasSlots ? <td className="px-3 py-2.5" /> : null}
        </tr>
      ))}
    </>
  )
}
