import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { DirectUserAssignmentPanel } from '@/features/archive-permission/components/DirectUserAssignmentPanel'
import { GroupAssignmentPanel } from '@/features/archive-permission/components/GroupAssignmentPanel'
import { ArchiveAclMatrixPanel } from '@/features/archive-permission/components/ArchiveAclMatrixPanel'
import { ArchivePermissionSlotList } from '@/features/archive-permission/components/ArchivePermissionSlotList'
import {
  activeArchiveFondsQueryOptions,
  archivePermissionConfigsQueryOptions,
  useCreateArchivePermissionConfig,
  useDeleteArchivePermissionConfig,
  useUpdateArchivePermissionConfig,
} from '@/features/archive-permission/queries'
import { createArchivePermissionConfigSchema } from '@/features/archive-permission/schemas'
import type {
  ArchivePermissionConfigListItemT,
  ArchivePermissionConfigStatusT,
  ArchivePermissionSlotT,
} from '@/features/archive-permission/types'
import { FormField, useAppForm } from '@/lib/forms'
import { cn } from '@/lib/utils/cn'

const routeApi = getRouteApi('/app/archive-permission/')

function slugifySlotCode(name: string, index: number) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base ? `${base}-${index}` : `slot-${index}`
}

function normalizeSlots(
  slots: Array<ArchivePermissionSlotT>,
): Array<ArchivePermissionSlotT> {
  return slots.map((slot, index) => ({
    ...slot,
    sortOrder: index + 1,
  }))
}

function slotsEqual(
  a: Array<ArchivePermissionSlotT>,
  b: Array<ArchivePermissionSlotT>,
) {
  return JSON.stringify(normalizeSlots(a)) === JSON.stringify(normalizeSlots(b))
}

function isToggleableConfigStatus(
  status: string,
): status is 'close' | 'ready' {
  return status === 'close' || status === 'ready'
}

export function ArchivePermissionConfigPage() {
  const { t } = useTranslation('archive-permission')
  const navigate = useNavigate({ from: '/app/archive-permission/' })
  const search = routeApi.useSearch()
  const activeTab = search.tab ?? 'acl'

  const [statusFilter, setStatusFilter] = useState<
    'all' | ArchivePermissionConfigStatusT
  >('all')
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftStatus, setDraftStatus] =
    useState<ArchivePermissionConfigStatusT>('draft')
  const [draftSlots, setDraftSlots] = useState<Array<ArchivePermissionSlotT>>(
    [],
  )
  const [addConfigOpen, setAddConfigOpen] = useState(false)
  const [configToDelete, setConfigToDelete] =
    useState<ArchivePermissionConfigListItemT | null>(null)
  const [renameSlot, setRenameSlot] = useState<ArchivePermissionSlotT | null>(
    null,
  )
  const [renameSlotName, setRenameSlotName] = useState('')
  const [slotToDelete, setSlotToDelete] =
    useState<ArchivePermissionSlotT | null>(null)
  const [isHandling, setIsHandling] = useState(false)

  const {
    data: configsData,
    isLoading: isLoadingConfigs,
    isError: isConfigsError,
  } = useQuery(archivePermissionConfigsQueryOptions())
  const { data: fondsData, isLoading: isLoadingFonds } = useQuery(
    activeArchiveFondsQueryOptions(),
  )

  const createConfigMutation = useCreateArchivePermissionConfig()
  const updateConfigMutation = useUpdateArchivePermissionConfig()
  const deleteConfigMutation = useDeleteArchivePermissionConfig()

  const configs = configsData?.items ?? []
  const fonds = fondsData?.items ?? []

  const filteredConfigs = useMemo(() => {
    if (statusFilter === 'all') return configs
    return configs.filter((config) => config.status === statusFilter)
  }, [configs, statusFilter])

  const selectedConfigId = useMemo(() => {
    if (
      search.configId &&
      filteredConfigs.some((config) => config.id === search.configId)
    ) {
      return search.configId
    }
    return filteredConfigs[0]?.id
  }, [filteredConfigs, search.configId])

  const selectedConfig = useMemo(
    () => configs.find((config) => config.id === selectedConfigId),
    [configs, selectedConfigId],
  )

  useEffect(() => {
    if (!selectedConfig) {
      setDraftName('')
      setDraftDescription('')
      setDraftStatus('draft')
      setDraftSlots([])
      return
    }

    setDraftName(selectedConfig.name)
    setDraftDescription(selectedConfig.description ?? '')
    setDraftStatus(selectedConfig.status)
    setDraftSlots(normalizeSlots(selectedConfig.slots))
  }, [selectedConfig])

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedConfig) return false
    return (
      draftName.trim() !== selectedConfig.name ||
      (draftDescription || '') !== (selectedConfig.description ?? '') ||
      draftStatus !== selectedConfig.status ||
      !slotsEqual(draftSlots, selectedConfig.slots)
    )
  }, [
    draftDescription,
    draftName,
    draftSlots,
    draftStatus,
    selectedConfig,
  ])

  const createForm = useAppForm({
    schema: createArchivePermissionConfigSchema,
    defaultValues: {
      name: '',
      description: '',
    },
    onSubmit: async ({ value }) => {
      const created = await createConfigMutation.mutateAsync({
        name: value.name.trim(),
        description: value.description?.trim() || null,
      })
      setAddConfigOpen(false)
      createForm.reset()
      void navigate({
        search: (prev) => ({ ...prev, configId: created.id, tab: 'configs' }),
      })
    },
  })

  const handleSelectConfig = (configId: string) => {
    void navigate({
      search: (prev) => ({ ...prev, configId }),
    })
  }

  const handleTabChange = (tab: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        tab: tab as 'configs' | 'groups' | 'direct',
      }),
    })
  }

  const handleSelectGroup = (groupId: string) => {
    void navigate({
      search: (prev) => ({ ...prev, groupId, tab: 'groups' }),
    })
  }

  const handleAddSlot = () => {
    const index = draftSlots.length + 1
    const slotName = t('detail.addSlot') + ` ${index}`
    const newSlot: ArchivePermissionSlotT = {
      slotCode: slugifySlotCode(slotName, index),
      slotName,
      sortOrder: index,
      permissionKeys: ['archive.warehouse.search'],
      fondIds: [],
    }
    setDraftSlots((prev) => normalizeSlots([...prev, newSlot]))
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
    setDraftSlots((prev) =>
      normalizeSlots(
        prev.filter((slot) => slot.slotCode !== slotToDelete.slotCode),
      ),
    )
    setSlotToDelete(null)
  }

  const handleSave = () => {
    if (!selectedConfigId) return

    updateConfigMutation.mutate({
      configId: selectedConfigId,
      payload: {
        name: draftName.trim(),
        description: draftDescription.trim() || null,
        status: draftStatus,
        slots: normalizeSlots(draftSlots),
      },
    })
  }

  const handleToggleStatus = (checked: boolean) => {
    if (!selectedConfig || !isToggleableConfigStatus(selectedConfig.status)) {
      setDraftStatus(checked ? 'ready' : 'close')
      return
    }
    setDraftStatus(checked ? 'ready' : 'close')
  }

  const handleDeleteConfig = async () => {
    if (!configToDelete || isHandling) return
    setIsHandling(true)

    try {
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
    } finally {
      setIsHandling(false)
    }
  }

  if (isLoadingConfigs) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isConfigsError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
        <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="acl">{t('tabs.acl')}</TabsTrigger>
          <TabsTrigger value="configs">{t('tabs.configsLegacy')}</TabsTrigger>
          <TabsTrigger value="groups">{t('tabs.groupAssignLegacy')}</TabsTrigger>
          <TabsTrigger value="direct">{t('tabs.directAssignLegacy')}</TabsTrigger>
        </TabsList>

        <TabsContent value="acl" className="mt-4 space-y-4">
          <ArchiveAclMatrixPanel />
        </TabsContent>

        <TabsContent value="configs" className="mt-4 space-y-4">
          <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {t('filters.all')}
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as typeof statusFilter)
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  <SelectItem value="draft">{t('filters.draft')}</SelectItem>
                  <SelectItem value="ready">{t('filters.ready')}</SelectItem>
                  <SelectItem value="close">{t('filters.close')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasUnsavedChanges ? (
              <Button
                type="button"
                onClick={handleSave}
                disabled={updateConfigMutation.isPending || !selectedConfigId}
              >
                {updateConfigMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {t('detail.save')}
              </Button>
            ) : null}
          </div>

          <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-md border border-border lg:h-[calc(100dvh-17rem)] lg:max-h-[52rem] lg:flex-row">
            <section className="flex w-full shrink-0 flex-col border-b border-border bg-card lg:w-64 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium">{t('list.title')}</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setAddConfigOpen(true)}
                  aria-label={t('list.add')}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto p-2 lg:max-h-none lg:min-h-0 lg:flex-1">
                {filteredConfigs.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-muted-foreground">
                    {t('list.empty')}
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
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent/60"
                          onClick={() => handleSelectConfig(config.id)}
                        >
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {config.name}
                          </span>
                          <StatusBadge status={config.status} />
                        </button>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
              {!selectedConfig ? (
                <div className="flex flex-1 items-center justify-center p-8">
                  <p className="text-sm text-muted-foreground">
                    {t('detail.empty')}
                  </p>
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{t('detail.name')}</Label>
                      <Input
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                      />
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <div className="space-y-1.5">
                        <Label>{t('detail.status')}</Label>
                        <div className="flex h-9 items-center gap-2">
                          <Switch
                            checked={draftStatus === 'ready'}
                            disabled={draftStatus === 'draft'}
                            onCheckedChange={handleToggleStatus}
                          />
                          <span className="text-sm">
                            {draftStatus === 'ready'
                              ? t('detail.statusReady')
                              : t(`status.${draftStatus}`)}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setConfigToDelete(selectedConfig)}
                      >
                        <Trash2 className="size-4" />
                        {t('detail.delete')}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t('detail.description')}</Label>
                    <Textarea
                      value={draftDescription}
                      onChange={(event) =>
                        setDraftDescription(event.target.value)
                      }
                      rows={2}
                    />
                  </div>

                  <ArchivePermissionSlotList
                    slots={draftSlots}
                    fonds={fonds}
                    fondsLoading={isLoadingFonds}
                    onSlotsChange={setDraftSlots}
                    onAddSlot={handleAddSlot}
                    onRenameSlot={(slot) => {
                      setRenameSlot(slot)
                      setRenameSlotName(slot.slotName)
                    }}
                    onDeleteSlot={setSlotToDelete}
                  />
                </div>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="groups" className="mt-4">
          <GroupAssignmentPanel
            selectedGroupId={search.groupId ?? null}
            onSelectGroupId={handleSelectGroup}
          />
        </TabsContent>

        <TabsContent value="direct" className="mt-4">
          <DirectUserAssignmentPanel />
        </TabsContent>
      </Tabs>

      <Dialog open={addConfigOpen} onOpenChange={setAddConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create.title')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void createForm.handleSubmit()
            }}
            className="space-y-4"
          >
            <FormField
              form={createForm}
              name="name"
              label={t('create.name')}
              placeholder={t('create.namePlaceholder')}
            />
            <FormField
              form={createForm}
              name="description"
              label={t('create.description')}
              placeholder={t('create.descriptionPlaceholder')}
              as="textarea"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddConfigOpen(false)}
              >
                {t('create.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createConfigMutation.isPending}
              >
                {createConfigMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {t('create.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameSlot)}
        onOpenChange={(open) => !open && setRenameSlot(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rename.title')}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameSlotName}
            onChange={(event) => setRenameSlotName(event.target.value)}
            placeholder={t('rename.placeholder')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameSlot(null)}>
              {t('create.cancel')}
            </Button>
            <Button onClick={handleRenameSlot}>{t('detail.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(configToDelete)}
        onOpenChange={(open) => !open && setConfigToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.configTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.configDescription', {
                name: configToDelete?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isHandling}>
              {t('delete.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isHandling}
              onClick={() => void handleDeleteConfig()}
            >
              {t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(slotToDelete)}
        onOpenChange={(open) => !open && setSlotToDelete(null)}
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
            <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSlot}>
              {t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
