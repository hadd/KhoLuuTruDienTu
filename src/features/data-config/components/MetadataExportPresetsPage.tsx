import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Eye,Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import { DataConfigSectionTabs } from '@/features/data-config/components/DataConfigSectionTabs'
import { MetadataExportColumnEditor } from '@/features/data-config/components/MetadataExportColumnEditor'
import type {MetadataExportColumnErrors} from '@/features/data-config/lib/metadataExportHelpers';
import {
  buildStructuralExportPreview,
  focusFirstExportColumnIssue,
  getExportColumnValidationMessage,
  validateExportColumnsConfig
} from '@/features/data-config/lib/metadataExportHelpers'
import {
  metadataExportPresetsQueryOptions,
  metadataTemplateDetailQueryOptions,
  metadataTemplatesQueryOptions,
  useCreateMetadataExportPreset,
  useDeleteMetadataExportPreset,
  useUpdateMetadataExportPreset,
} from '@/features/data-config/queries'
import type {
  MetadataExportColumnConfigT,
  MetadataExportFieldCatalogItemT,
  MetadataExportPresetT,
} from '@/features/data-config/types'
import { MetadataExportPreviewDialog } from '@/features/data-management/components/MetadataExportPreviewDialog'
import { cn } from '@/lib/utils/cn'

const routeApi = getRouteApi('/app/data-config/metadata-export-presets')

function columnsAreEqual(
  a: Array<MetadataExportColumnConfigT>,
  b: Array<MetadataExportColumnConfigT>,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function MetadataExportPresetsPage() {
  const { t } = useTranslation('data-config')
  const navigate = routeApi.useNavigate()
  const { presetId, templateId } = routeApi.useSearch()

  const {
    data: presets = [],
    isLoading: isLoadingPresets,
    isError: isPresetsError,
  } = useQuery(metadataExportPresetsQueryOptions())

  const {
    data: templates = [],
    isLoading: isLoadingTemplates,
  } = useQuery(metadataTemplatesQueryOptions())

  const selectedPresetId =
    presetId && presets.some((item) => item.id === presetId)
      ? presetId
      : presets[0]?.id

  const selectedPreset = presets.find((item) => item.id === selectedPresetId)

  const selectedTemplateId =
    templateId && templates.some((item) => item.id === templateId)
      ? templateId
      : templates[0]?.id

  const { data: templateDetail, isLoading: isLoadingTemplateDetail } = useQuery(
    metadataTemplateDetailQueryOptions(selectedTemplateId ?? ''),
  )

  const fieldCatalog = useMemo<Array<MetadataExportFieldCatalogItemT>>(() => {
    if (!templateDetail?.fieldCatalog) return []
    return templateDetail.fieldCatalog.map((item) => ({
      key: item.key,
      groupCode: item.groupCode,
      groupName: item.groupName,
      fieldName: item.fieldName,
      display: item.display,
    }))
  }, [templateDetail])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [columns, setColumns] = useState<Array<MetadataExportColumnConfigT>>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MetadataExportPresetT | null>(
    null,
  )
  const [previewOpen, setPreviewOpen] = useState(false)
  const [columnErrors, setColumnErrors] = useState<MetadataExportColumnErrors>({})
  const [nameError, setNameError] = useState(false)
  const [isHandling, setIsHandling] = useState(false)

  const createMutation = useCreateMetadataExportPreset()
  const updateMutation = useUpdateMetadataExportPreset()
  const deleteMutation = useDeleteMetadataExportPreset()

  useEffect(() => {
    if (!selectedPreset) {
      setName('')
      setDescription('')
      setColumns([])
      return
    }

    setName(selectedPreset.name)
    setDescription(selectedPreset.description)
    setColumns(selectedPreset.columns)
  }, [selectedPreset])

  const isDirty =
    Boolean(selectedPreset) &&
    (name !== selectedPreset.name ||
      description !== selectedPreset.description ||
      !columnsAreEqual(columns, selectedPreset.columns))

  const isSaving = createMutation.isPending || updateMutation.isPending || isHandling

  const structuralPreview = useMemo(() => {
    const result = validateExportColumnsConfig(columns)
    if (result.issues.length > 0) return null
    return buildStructuralExportPreview(columns, fieldCatalog)
  }, [columns, fieldCatalog])

  function runColumnValidation(requireName = false): boolean {
    if (requireName && !name.trim()) {
      setNameError(true)
      toast.error(t('metadataExport.validation.missingName'))
      focusFirstExportColumnIssue({ code: 'missingName' })
      return false
    }

    setNameError(false)
    const result = validateExportColumnsConfig(columns)
    if (result.issues.length > 0) {
      setColumnErrors(result.columnErrors)
      const firstIssue = result.issues[0]
      if (firstIssue) {
        toast.error(getExportColumnValidationMessage(t, firstIssue))
        focusFirstExportColumnIssue(firstIssue)
      }
      return false
    }

    setColumnErrors({})
    return true
  }

  function handleColumnsChange(nextColumns: Array<MetadataExportColumnConfigT>) {
    setColumns(nextColumns)
    setColumnErrors({})
  }

  function handleNameChange(value: string) {
    setName(value)
    if (value.trim()) {
      setNameError(false)
    }
  }

  function selectPreset(nextPresetId: string) {
    void navigate({
      search: (prev) => ({
        ...prev,
        presetId: nextPresetId,
      }),
    })
  }

  function selectTemplate(nextTemplateId: string) {
    void navigate({
      search: (prev) => ({
        ...prev,
        templateId: nextTemplateId,
      }),
    })
  }

  async function handleSave() {
    if (!selectedPreset || !runColumnValidation(true)) return
    if (isHandling) return
    setIsHandling(true)

    try {
      await updateMutation.mutateAsync({
        presetId: selectedPreset.id,
        payload: {
          name: name.trim(),
          description: description.trim() || null,
          columns,
        },
      })
    } finally {
      setIsHandling(false)
    }
  }

  async function handleCreate() {
    if (!createName.trim()) return
    if (isHandling) return
    setIsHandling(true)

    try {
      const created = await createMutation.mutateAsync({
        name: createName.trim(),
        description: createDescription.trim() || null,
        columns: [{ header: t('metadataExport.defaultColumnHeader'), fieldKeys: [], separator: ', ' }],
      })

      setCreateOpen(false)
      setCreateName('')
      setCreateDescription('')
      selectPreset(created.id)
    } finally {
      setIsHandling(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    if (isHandling) return
    setIsHandling(true)

    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)

      if (selectedPresetId === deleteTarget.id) {
        const remaining = presets.filter((item) => item.id !== deleteTarget.id)
        void navigate({
          search: (prev) => ({
            ...prev,
            presetId: remaining[0]?.id,
          }),
        })
      }
    } finally {
      setIsHandling(false)
    }
  }

  if (isLoadingPresets) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isPresetsError) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-8 text-sm text-muted-foreground">
        {t('errors.loadFailed')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <DataConfigSectionTabs active="metadata-export-presets" />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-sm font-medium">{t('metadataExport.presetList')}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              {t('metadataExport.addPreset')}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {presets.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">
                {t('metadataExport.emptyPresets')}
              </p>
            ) : (
              presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => selectPreset(preset.id)}
                  className={cn(
                    'mb-1 flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors',
                    preset.id === selectedPresetId
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/60',
                  )}
                >
                  <span className="text-sm font-medium">{preset.name}</span>
                  {preset.description ? (
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {preset.description}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-4">
          {!selectedPreset ? (
            <p className="text-sm text-muted-foreground">
              {t('metadataExport.selectPresetHint')}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">{t('metadataExport.editPreset')}</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => {
                      if (!runColumnValidation(true)) return
                      setPreviewOpen(true)
                    }}
                  >
                    <Eye className="size-4" aria-hidden />
                    {t('metadataExport.preview')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => setDeleteTarget(selectedPreset)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t('metadataExport.deletePreset')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!isDirty || isSaving}
                    onClick={() => void handleSave()}
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Save className="size-4" aria-hidden />
                    )}
                    {t('metadataExport.savePreset')}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('metadataExport.nameLabel')}</Label>
                  <Input
                    data-export-preset-name
                    value={name}
                    aria-invalid={nameError}
                    className={cn(nameError && 'border-destructive')}
                    onChange={(event) => handleNameChange(event.target.value)}
                  />
                  {nameError ? (
                    <p className="text-xs text-destructive">
                      {t('metadataExport.validation.missingName')}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>{t('metadataExport.descriptionLabel')}</Label>
                  <Input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('metadataExport.referenceTemplateLabel')}</Label>
                <Select
                  value={selectedTemplateId}
                  disabled={isLoadingTemplates || templates.length === 0}
                  onValueChange={selectTemplate}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('metadataExport.referenceTemplatePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('metadataExport.referenceTemplateHint')}
                </p>
              </div>

              {isLoadingTemplateDetail ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('metadataExport.loadingFields')}
                </div>
              ) : (
                <MetadataExportColumnEditor
                  columns={columns}
                  fieldCatalog={fieldCatalog}
                  columnErrors={columnErrors}
                  disabled={isSaving}
                  onChange={handleColumnsChange}
                />
              )}
            </div>
          )}
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('metadataExport.createPresetTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{t('metadataExport.nameLabel')}</Label>
              <Input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('metadataExport.descriptionLabel')}</Label>
              <Input
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!createName.trim() || createMutation.isPending || isHandling}
              onClick={() => void handleCreate()}
            >
              {t('metadataExport.createPreset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('metadataExport.deletePresetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('metadataExport.deletePresetDescription', {
                name: deleteTarget?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={isHandling} onClick={() => void handleDelete()}>
              {t('metadataExport.deletePreset')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MetadataExportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={structuralPreview}
        mode="structure"
      />
    </div>
  )
}
