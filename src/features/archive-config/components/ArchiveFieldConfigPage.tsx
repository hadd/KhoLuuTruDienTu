import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ARCHIVE_PRESET_FIELDS,
  ARCHIVE_PRESET_FIELD_KEYS,
} from '@/features/archive-config/constants/preset-fields'
import { CustomFieldDialog } from '@/features/archive-config/components/CustomFieldDialog'
import { ArchiveFieldConfigDeleteDialog } from '@/features/archive-config/components/ArchiveFieldConfigDeleteDialog'
import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import {
  archiveFieldConfigsQueryOptions,
  useCreateArchiveFieldConfigMutation,
  useDeleteArchiveFieldConfigMutation,
  useReorderArchiveFieldConfigsMutation,
  useUpdateArchiveFieldConfigMutation,
} from '@/features/archive-config/queries'
import type { ArchiveFieldConfigT } from '@/features/archive-config/types'
import { translateError } from '@/lib/utils/translate-error'

function RequiredMark() {
  return <span className="text-destructive"> *</span>
}

export function ArchiveFieldConfigPage() {
  const { t } = useTranslation('archive-config')
  const { canManageArchiveConfig } = useArchiveConfigAccess()
  const { data: configs = [], isPending, isError } = useQuery(
    archiveFieldConfigsQueryOptions(),
  )
  const createMutation = useCreateArchiveFieldConfigMutation()
  const updateMutation = useUpdateArchiveFieldConfigMutation()
  const reorderMutation = useReorderArchiveFieldConfigsMutation()

  const [customDialogOpen, setCustomDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCustomField, setEditingCustomField] = useState<ArchiveFieldConfigT | null>(
    null,
  )
  const [deletingCustomField, setDeletingCustomField] = useState<ArchiveFieldConfigT | null>(
    null,
  )

  const configByKey = useMemo(
    () => new Map(configs.map((config) => [config.fieldKey, config])),
    [configs],
  )

  const customFields = useMemo(
    () =>
      configs
        .filter(
          (config) =>
            config.isActive && !ARCHIVE_PRESET_FIELD_KEYS.has(config.fieldKey),
        )
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [configs],
  )

  async function handlePresetToggle(
    preset: (typeof ARCHIVE_PRESET_FIELDS)[number],
    enabled: boolean,
  ) {
    const existing = configByKey.get(preset.fieldKey)
    try {
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          payload: { isActive: enabled },
        })
        return
      }
      if (!enabled) return

      await createMutation.mutateAsync({
        fieldKey: preset.fieldKey,
        label: preset.label,
        fieldType: preset.fieldType,
        referenceSource: preset.referenceSource,
        dependsOnFieldKey: preset.dependsOnFieldKey ?? null,
        isRequired: false,
        isActive: true,
        displayOrder: configs.length,
      })
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  async function handlePresetRequiredToggle(
    preset: (typeof ARCHIVE_PRESET_FIELDS)[number],
    isRequired: boolean,
  ) {
    const existing = configByKey.get(preset.fieldKey)
    if (!existing) return
    try {
      await updateMutation.mutateAsync({
        id: existing.id,
        payload: { isRequired },
      })
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  async function handleCustomSubmit(payload: {
    fieldKey: string
    label: string
    fieldType: ArchiveFieldConfigT['fieldType']
    isRequired: boolean
    options: Array<{ value: string; label: string }>
  }) {
    try {
      if (editingCustomField) {
        await updateMutation.mutateAsync({
          id: editingCustomField.id,
          payload: {
            fieldKey: payload.fieldKey,
            label: payload.label,
            fieldType: payload.fieldType,
            isRequired: payload.isRequired,
            options: payload.options,
          },
        })
        toast.success(t('messages.updated'))
        return
      }

      await createMutation.mutateAsync({
        ...payload,
        displayOrder: configs.length,
        isActive: true,
      })
      toast.success(t('messages.created'))
    } catch (error) {
      toast.error(translateError(error))
      throw error
    }
  }

  function openDeleteDialog(field: ArchiveFieldConfigT) {
    setDeletingCustomField(field)
    setDeleteDialogOpen(true)
  }

  async function moveCustomField(field: ArchiveFieldConfigT, direction: -1 | 1) {
    const orderedIds = customFields.map((item) => item.id)
    const index = orderedIds.indexOf(field.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= orderedIds.length) return

    const nextIds = [...orderedIds]
    ;[nextIds[index], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[index]]

    const presetIds = configs
      .filter((config) => ARCHIVE_PRESET_FIELD_KEYS.has(config.fieldKey) && config.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((config) => config.id)

    try {
      await reorderMutation.mutateAsync([...presetIds, ...nextIds])
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  if (!canManageArchiveConfig) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('errors.noPermission')}
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive bg-card p-8 text-center text-sm text-destructive">
        {t('errors.loadFailed')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t('sections.presetFields')}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {ARCHIVE_PRESET_FIELDS.map((preset) => {
            const config = configByKey.get(preset.fieldKey)
            const enabled = config?.isActive ?? false
            const isRequired = config?.isRequired ?? false

            return (
              <Card key={preset.fieldKey} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {preset.label}
                      {enabled && isRequired ? <RequiredMark /> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`referenceSources.${preset.referenceSource}`)}
                    </p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      void handlePresetToggle(preset, checked)
                    }
                    aria-label={preset.label}
                  />
                </div>
                {enabled ? (
                  <label className="mt-3 flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={isRequired}
                      onCheckedChange={(checked) =>
                        void handlePresetRequiredToggle(preset, checked === true)
                      }
                      aria-label={t('customField.required')}
                    />
                    <span className="text-sm text-muted-foreground">
                      {t('customField.required')}
                    </span>
                  </label>
                ) : null}
              </Card>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{t('sections.customFields')}</h2>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingCustomField(null)
              setCustomDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" />
            {t('customField.add')}
          </Button>
        </div>

        {customFields.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            {t('customField.empty')}
          </Card>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('customField.columns.label')}</TableHead>
                  <TableHead>{t('customField.columns.type')}</TableHead>
                  <TableHead className="w-[132px] text-right">
                    {t('customField.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customFields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">
                      {field.label}
                      {field.isRequired ? <RequiredMark /> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t(`fieldTypes.${field.fieldType}`)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={index === 0}
                          title={t('actions.moveUp')}
                          onClick={() => void moveCustomField(field, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={index === customFields.length - 1}
                          title={t('actions.moveDown')}
                          onClick={() => void moveCustomField(field, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title={t('actions.edit')}
                          onClick={() => {
                            setEditingCustomField(field)
                            setCustomDialogOpen(true)
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title={t('actions.delete')}
                          onClick={() => openDeleteDialog(field)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <CustomFieldDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        field={editingCustomField}
        onSubmit={handleCustomSubmit}
      />

      <ArchiveFieldConfigDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setDeletingCustomField(null)
        }}
        field={deletingCustomField}
        onDeleted={() => toast.success(t('messages.deleted'))}
      />
    </div>
  )
}
