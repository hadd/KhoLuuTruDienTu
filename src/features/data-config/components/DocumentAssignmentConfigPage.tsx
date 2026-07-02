import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ChevronRight, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/common/StatusBadge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DocumentAssignmentMatrix } from '@/features/data-config/components/DocumentAssignmentMatrix'
import { fieldCatalogToGroups } from '@/features/data-config/lib/metadataTemplateHelpers'
import {
  metadataTemplateDetailQueryOptions,
  permissionConfigQueryOptions,
  permissionConfigsQueryOptions,
  permissionTemplateOptionsQueryOptions,
  useCreatePermissionConfig,
  useDeletePermissionConfig,
  useUpdatePermissionConfigSlots,
  useUpdatePermissionConfigStatus,
} from '@/features/data-config/queries'
import { createPermissionConfigSchema } from '@/features/data-config/schemas'
import type {
  MetadataPermissionConfigListItemT,
  MetadataPermissionSlotT,
} from '@/features/data-config/types'
import { FormField, useAppForm } from '@/lib/forms'
import { cn } from '@/lib/utils/cn'

const routeApi = getRouteApi('/app/data-config/document-assignment')

function isToggleableConfigStatus(status: string): status is 'close' | 'ready' {
  return status === 'close' || status === 'ready'
}

function generateSlotCode(
  existingSlots: Array<MetadataPermissionSlotT>,
): string {
  const editorNumbers = existingSlots
    .map((slot) => {
      const match = /^Editor(\d+)$/.exec(slot.slotCode)
      return match ? Number.parseInt(match[1], 10) : 0
    })
    .filter((num) => num > 0)

  if (editorNumbers.length > 0) {
    return `Editor${Math.max(...editorNumbers) + 1}`
  }

  return `slot-${Date.now()}`
}

function normalizeSlots(
  slots: Array<MetadataPermissionSlotT>,
): Array<MetadataPermissionSlotT> {
  return slots.map((slot, index) => ({
    ...slot,
    sortOrder: index,
  }))
}

function slotsAreEqual(
  a: Array<MetadataPermissionSlotT>,
  b: Array<MetadataPermissionSlotT>,
): boolean {
  if (a.length !== b.length) return false
  return a.every((slot, index) => {
    const other = b[index]
    if (!other) return false
    if (slot.slotCode !== other.slotCode) return false
    if (slot.slotName !== other.slotName) return false
    if (slot.sortOrder !== other.sortOrder) return false
    if (slot.fieldKeys.length !== other.fieldKeys.length) return false
    return slot.fieldKeys.every(
      (key, keyIndex) => key === other.fieldKeys[keyIndex],
    )
  })
}

export function DocumentAssignmentConfigPage() {
  const { t } = useTranslation('data-config')
  const navigate = routeApi.useNavigate()
  const { templateId, configId } = routeApi.useSearch()

  const {
    data: templateOptions = [],
    isLoading: isLoadingTemplateOptions,
    isError: isTemplateOptionsError,
  } = useQuery(permissionTemplateOptionsQueryOptions())

  const {
    data: allConfigs = [],
    isLoading: isLoadingConfigs,
    isError: isConfigsError,
  } = useQuery(permissionConfigsQueryOptions())

  const selectedTemplateId =
    templateId && templateOptions.some((item) => item.id === templateId)
      ? templateId
      : templateOptions[0]?.id

  const filteredConfigs = useMemo(
    () =>
      selectedTemplateId
        ? allConfigs.filter(
            (config) => config.templateId === selectedTemplateId,
          )
        : [],
    [allConfigs, selectedTemplateId],
  )

  const selectedConfigId =
    configId && filteredConfigs.some((item) => item.id === configId)
      ? configId
      : filteredConfigs[0]?.id

  const { data: metadataTemplate } = useQuery({
    ...metadataTemplateDetailQueryOptions(selectedTemplateId ?? ''),
    enabled: Boolean(selectedTemplateId),
  })

  const {
    data: configDetail,
    isLoading: isLoadingConfigDetail,
    isError: isConfigDetailError,
  } = useQuery({
    ...permissionConfigQueryOptions(selectedConfigId ?? ''),
    enabled: Boolean(selectedConfigId),
  })

  const schemaGroups = useMemo(
    () =>
      fieldCatalogToGroups(
        metadataTemplate?.fieldCatalog ??
          configDetail?.template.fieldCatalog ??
          [],
      ),
    [metadataTemplate?.fieldCatalog, configDetail?.template.fieldCatalog],
  )

  const [draftSlots, setDraftSlots] = useState<Array<MetadataPermissionSlotT>>(
    [],
  )
  const [addSubTemplateOpen, setAddSubTemplateOpen] = useState(false)
  const [addSlotOpen, setAddSlotOpen] = useState(false)
  const [slotNameInput, setSlotNameInput] = useState('')
  const [renameSlot, setRenameSlot] = useState<MetadataPermissionSlotT | null>(
    null,
  )
  const [renameSlotName, setRenameSlotName] = useState('')
  const [slotToDelete, setSlotToDelete] =
    useState<MetadataPermissionSlotT | null>(null)
  const [configToDelete, setConfigToDelete] =
    useState<MetadataPermissionConfigListItemT | null>(null)

  const createConfigMutation = useCreatePermissionConfig()
  const updateSlotsMutation = useUpdatePermissionConfigSlots()
  const deleteConfigMutation = useDeletePermissionConfig()
  const updateStatusMutation = useUpdatePermissionConfigStatus()

  const createForm = useAppForm({
    schema: createPermissionConfigSchema,
    defaultValues: {
      name: '',
      description: '',
    },
    onSubmit: async ({ value }) => {
      if (!selectedTemplateId) return

      const created = await createConfigMutation.mutateAsync({
        name: value.name,
        description: value.description,
        templateId: selectedTemplateId,
      })

      setAddSubTemplateOpen(false)

      void navigate({
        search: (prev) => ({
          ...prev,
          templateId: selectedTemplateId,
          configId: created.id,
        }),
      })
    },
  })

  useEffect(() => {
    if (templateOptions.length === 0) return

    const resolvedTemplateId =
      templateId && templateOptions.some((item) => item.id === templateId)
        ? templateId
        : templateOptions[0]?.id

    if (resolvedTemplateId && resolvedTemplateId !== templateId) {
      void navigate({
        search: (prev) => ({
          ...prev,
          templateId: resolvedTemplateId,
          configId: undefined,
        }),
        replace: true,
      })
    }
  }, [templateId, templateOptions, navigate])

  useEffect(() => {
    if (!selectedTemplateId || filteredConfigs.length === 0) return

    const resolvedConfigId =
      configId && filteredConfigs.some((item) => item.id === configId)
        ? configId
        : filteredConfigs[0]?.id

    if (resolvedConfigId && resolvedConfigId !== configId) {
      void navigate({
        search: (prev) => ({
          ...prev,
          configId: resolvedConfigId,
        }),
        replace: true,
      })
    }
  }, [configId, filteredConfigs, selectedTemplateId, navigate])

  useEffect(() => {
    if (!configDetail) {
      setDraftSlots([])
      return
    }
    setDraftSlots(normalizeSlots(configDetail.slots))
  }, [configDetail])

  const hasUnsavedChanges = configDetail
    ? !slotsAreEqual(draftSlots, normalizeSlots(configDetail.slots))
    : false

  const handleSelectTemplate = (nextTemplateId: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        templateId: nextTemplateId,
        configId: undefined,
      }),
    })
  }

  const handleSelectConfig = (nextConfigId: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        configId: nextConfigId,
      }),
    })
  }

  const handleOpenAddSlot = () => {
    setSlotNameInput('')
    setAddSlotOpen(true)
  }

  const handleAddSlot = () => {
    const trimmed = slotNameInput.trim()
    if (!trimmed) return

    const newSlot: MetadataPermissionSlotT = {
      slotCode: generateSlotCode(draftSlots),
      slotName: trimmed,
      sortOrder: draftSlots.length,
      fieldKeys: [],
    }

    setDraftSlots((prev) => normalizeSlots([...prev, newSlot]))
    setSlotNameInput('')
    setAddSlotOpen(false)
  }

  const handleRenameSlot = () => {
    if (!renameSlot) return
    const trimmed = renameSlotName.trim()
    if (!trimmed) return

    setDraftSlots((prev) =>
      prev.map((slot) =>
        slot.slotCode === renameSlot.slotCode
          ? { ...slot, slotName: trimmed }
          : slot,
      ),
    )
    setRenameSlot(null)
    setRenameSlotName('')
  }

  const handleDeleteSlot = () => {
    if (!slotToDelete) return

    const remaining = draftSlots.filter(
      (slot) => slot.slotCode !== slotToDelete.slotCode,
    )
    setDraftSlots(normalizeSlots(remaining))
    setSlotToDelete(null)
  }

  const handleSaveSlots = () => {
    if (!selectedConfigId) return

    updateSlotsMutation.mutate({
      configId: selectedConfigId,
      payload: { slots: normalizeSlots(draftSlots) },
    })
  }

  const handleToggleConfigStatus = (
    config: MetadataPermissionConfigListItemT,
    checked: boolean,
  ) => {
    if (!isToggleableConfigStatus(config.status)) return

    const nextStatus: 'close' | 'ready' = checked ? 'ready' : 'close'
    if (nextStatus === config.status) return

    updateStatusMutation.mutate({
      configId: config.id,
      payload: { status: nextStatus },
    })
  }

  const handleDeleteConfig = async () => {
    if (!configToDelete) return

    const deletedConfigId = configToDelete.id
    const remaining = filteredConfigs.filter(
      (config) => config.id !== deletedConfigId,
    )

    await deleteConfigMutation.mutateAsync(deletedConfigId)
    setConfigToDelete(null)

    void navigate({
      search: (prev) => ({
        ...prev,
        configId:
          deletedConfigId === selectedConfigId
            ? remaining[0]?.id
            : prev.configId,
      }),
    })
  }

  const isInitialLoading = isLoadingTemplateOptions || isLoadingConfigs

  if (isInitialLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isTemplateOptionsError || isConfigsError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
        <p className="text-sm text-muted-foreground">
          {t('errors.loadFailed')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold text-foreground">
          {t('documentAssignment.title')}
        </h1>
      </div>

      {templateOptions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-border bg-muted/30 p-8">
          <p className="text-sm text-muted-foreground">
            {t('documentAssignment.empty.noTemplate')}
          </p>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {t('documentAssignment.templateLabel')}
              </Label>
              <Select
                value={selectedTemplateId}
                onValueChange={handleSelectTemplate}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue
                    placeholder={t('documentAssignment.templatePlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <span className="truncate">{template.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasUnsavedChanges ? (
              <Button
                type="button"
                onClick={handleSaveSlots}
                disabled={updateSlotsMutation.isPending || !selectedConfigId}
              >
                {updateSlotsMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {t('documentAssignment.saveSlots')}
              </Button>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-border">
            <section className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium text-foreground">
                  {t('documentAssignment.columns.subTemplate')}
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={!selectedTemplateId}
                  onClick={() => setAddSubTemplateOpen(true)}
                  aria-label={t('documentAssignment.subTemplates.add')}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {!selectedTemplateId ? (
                  <p className="px-2 py-4 text-sm text-muted-foreground">
                    {t('documentAssignment.empty.selectTemplate')}
                  </p>
                ) : filteredConfigs.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-muted-foreground">
                    {t('documentAssignment.subTemplates.empty')}
                  </p>
                ) : (
                  filteredConfigs.map((config) => {
                    const isSelected = config.id === selectedConfigId

                    return (
                      <div
                        key={config.id}
                        className={cn(
                          'flex items-center gap-1 rounded-md',
                          isSelected && 'bg-accent/50',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectConfig(config.id)}
                          className={cn(
                            'flex min-w-0 flex-1 flex-col gap-1 rounded-md px-3 py-2 text-left text-sm transition-colors',
                            isSelected
                              ? 'text-accent-foreground'
                              : 'text-foreground hover:bg-accent/50',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">
                              {config.name}
                            </span>
                            {isSelected ? (
                              <ChevronRight className="size-4 shrink-0" />
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              status={config.status}
                              label={t(
                                `documentAssignment.status.${config.status}`,
                                {
                                  defaultValue: config.status,
                                },
                              )}
                              className="text-[10px]"
                            />
                            <span className="text-xs text-muted-foreground">
                              {t('documentAssignment.subTemplates.slotCount', {
                                count: config.slotCount,
                              })}
                            </span>
                          </div>
                        </button>
                        {isToggleableConfigStatus(config.status) ? (
                          <Switch
                            checked={config.status === 'ready'}
                            disabled={
                              updateStatusMutation.isPending &&
                              updateStatusMutation.variables?.configId ===
                                config.id
                            }
                            onCheckedChange={(checked) =>
                              handleToggleConfigStatus(config, checked)
                            }
                            onClick={(event) => event.stopPropagation()}
                            aria-label={t('documentAssignment.status.toggleLabel')}
                            className="shrink-0"
                          />
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={t(
                            'documentAssignment.subTemplates.delete',
                          )}
                          onClick={() => setConfigToDelete(config)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            <section className="flex min-w-0 flex-1 flex-col bg-card">
              {!selectedConfigId ? (
                <div className="flex flex-1 items-center justify-center p-8">
                  <p className="text-sm text-muted-foreground">
                    {t('documentAssignment.empty.selectSubTemplate')}
                  </p>
                </div>
              ) : isConfigDetailError ? (
                <div className="flex flex-1 items-center justify-center p-8">
                  <p className="text-sm text-destructive">
                    {t('documentAssignment.errors.configDetailFailed')}
                  </p>
                </div>
              ) : (
                <DocumentAssignmentMatrix
                  schema={schemaGroups}
                  slots={draftSlots}
                  isLoading={isLoadingConfigDetail}
                  disabled={!selectedConfigId}
                  onSlotsChange={setDraftSlots}
                  onAddSlot={handleOpenAddSlot}
                  onRenameSlot={(slot) => {
                    setRenameSlot(slot)
                    setRenameSlotName(slot.slotName)
                  }}
                  onDeleteSlot={setSlotToDelete}
                />
              )}
            </section>
          </div>
        </>
      )}

      <Dialog open={addSubTemplateOpen} onOpenChange={setAddSubTemplateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('documentAssignment.subTemplates.addTitle')}
            </DialogTitle>
          </DialogHeader>
          <form
            key={addSubTemplateOpen ? 'open' : 'closed'}
            onSubmit={(event) => {
              event.preventDefault()
              void createForm.handleSubmit()
            }}
            className="space-y-4"
          >
            <FormField
              form={createForm}
              name="name"
              label={t('documentAssignment.subTemplates.nameLabel')}
              placeholder={t('documentAssignment.subTemplates.namePlaceholder')}
            />
            <FormField
              form={createForm}
              name="description"
              label={t('documentAssignment.subTemplates.descriptionLabel')}
              placeholder={t(
                'documentAssignment.subTemplates.descriptionPlaceholder',
              )}
              as="textarea"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddSubTemplateOpen(false)}
                disabled={createConfigMutation.isPending}
              >
                {t('actions.cancel')}
              </Button>
              <Button type="submit" disabled={createConfigMutation.isPending}>
                {createConfigMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {t('documentAssignment.subTemplates.add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addSlotOpen}
        onOpenChange={(open) => {
          setAddSlotOpen(open)
          if (!open) setSlotNameInput('')
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('documentAssignment.slots.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="slot-name">
              {t('documentAssignment.slots.nameLabel')}
            </Label>
            <Input
              id="slot-name"
              value={slotNameInput}
              onChange={(event) => setSlotNameInput(event.target.value)}
              placeholder={t('documentAssignment.slots.namePlaceholder')}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddSlotOpen(false)}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleAddSlot}
              disabled={!slotNameInput.trim()}
            >
              {t('documentAssignment.slots.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameSlot)}
        onOpenChange={(open) => {
          if (!open) {
            setRenameSlot(null)
            setRenameSlotName('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('documentAssignment.slots.renameTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-slot-name">
              {t('documentAssignment.slots.nameLabel')}
            </Label>
            <Input
              id="rename-slot-name"
              value={renameSlotName}
              onChange={(event) => setRenameSlotName(event.target.value)}
              placeholder={t('documentAssignment.slots.namePlaceholder')}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameSlot(null)}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleRenameSlot}
              disabled={!renameSlotName.trim()}
            >
              {t('documentAssignment.slots.rename')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(slotToDelete)}
        onOpenChange={(open) => {
          if (!open) setSlotToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.slotTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.slotDescription', {
                name: slotToDelete?.slotName ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete.cancelButton')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSlot}>
              {t('delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(configToDelete)}
        onOpenChange={(open) => {
          if (!open) setConfigToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.subTemplateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.subTemplateDescription', {
                name: configToDelete?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteConfigMutation.isPending}>
              {t('delete.cancelButton')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteConfig()}
              disabled={deleteConfigMutation.isPending}
            >
              {deleteConfigMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {t('delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
