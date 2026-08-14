import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Eye, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { MetadataExportColumnErrors } from '@/features/data-config/lib/metadataExportHelpers'
import {
  buildStructuralExportPreview,
  focusFirstExportColumnIssue,
  getExportColumnValidationMessage,
  groupsToExportFieldCatalog,
  inferReferenceTemplateId,
  validateExportColumnsConfig,
} from '@/features/data-config/lib/metadataExportHelpers'
import {
  metadataExportPresetsQueryOptions,
  metadataTemplatesQueryOptions,
  useCreateMetadataExportPreset,
  useDeleteMetadataExportPreset,
  useUpdateMetadataExportPreset,
} from '@/features/data-config/queries'
import type {
  DocumentTypeTemplateT,
  MetadataExportColumnConfigT,
  MetadataExportFieldCatalogItemT,
  MetadataExportPresetT,
} from '@/features/data-config/types'
import { MetadataExportPreviewDialog } from '@/features/data-management/components/MetadataExportPreviewDialog'
import { cn } from '@/lib/utils/cn'

const routeApi = getRouteApi('/app/data-config/metadata-export-presets')

const REFERENCE_TEMPLATE_STORAGE_KEY =
  'metadata-export-preset-reference-templates'

function columnsAreEqual(
  a: Array<MetadataExportColumnConfigT>,
  b: Array<MetadataExportColumnConfigT>,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function draftKey(presetId: string, templateId: string) {
  return `${presetId}:${templateId}`
}

function cloneColumns(
  source: Array<MetadataExportColumnConfigT>,
): Array<MetadataExportColumnConfigT> {
  return source.map((column) => ({
    ...column,
    fieldKeys: [...column.fieldKeys],
  }))
}

function readStoredReferenceTemplates(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(REFERENCE_TEMPLATE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.length > 0) {
        result[key] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

function writeStoredReferenceTemplates(map: Record<string, string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      REFERENCE_TEMPLATE_STORAGE_KEY,
      JSON.stringify(map),
    )
  } catch {
    // Ignore quota / private mode failures.
  }
}

function resolveTemplateIdForPreset(input: {
  presetId: string
  presetColumns?: Array<MetadataExportColumnConfigT>
  templates: Array<Pick<DocumentTypeTemplateT, 'id' | 'groups'>>
  rememberedByPreset: Record<string, string>
}): string | undefined {
  const { presetId, presetColumns, templates, rememberedByPreset } = input
  if (templates.length === 0) return undefined

  const remembered = rememberedByPreset[presetId]
  if (remembered && templates.some((item) => item.id === remembered)) {
    return remembered
  }

  if (presetColumns) {
    const inferred = inferReferenceTemplateId(presetColumns, templates)
    if (inferred) return inferred
  }

  return templates[0]?.id
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

  const [referenceTemplateByPreset, setReferenceTemplateByPreset] = useState<
    Record<string, string>
  >(() => readStoredReferenceTemplates())

  const selectedPresetId =
    presetId && presets.some((item) => item.id === presetId)
      ? presetId
      : presets[0]?.id

  const selectedPreset = presets.find((item) => item.id === selectedPresetId)

  const selectedTemplateId = selectedPresetId
    ? resolveTemplateIdForPreset({
        presetId: selectedPresetId,
        presetColumns: selectedPreset?.columns,
        templates,
        rememberedByPreset: referenceTemplateByPreset,
      })
    : undefined

  const selectedTemplate = templates.find(
    (item) => item.id === selectedTemplateId,
  )

  const fieldCatalog = useMemo<Array<MetadataExportFieldCatalogItemT>>(() => {
    if (!selectedTemplate) return []
    return groupsToExportFieldCatalog(selectedTemplate.groups)
  }, [selectedTemplate])

  function rememberReferenceTemplate(presetKey: string, nextTemplateId: string) {
    setReferenceTemplateByPreset((prev) => {
      if (prev[presetKey] === nextTemplateId) return prev
      const next = { ...prev, [presetKey]: nextTemplateId }
      writeStoredReferenceTemplates(next)
      return next
    })
  }

  useEffect(() => {
    if (!selectedPresetId || !selectedTemplateId) return
    if (referenceTemplateByPreset[selectedPresetId] === selectedTemplateId) {
      return
    }
    setReferenceTemplateByPreset((prev) => {
      if (prev[selectedPresetId] === selectedTemplateId) return prev
      const next = { ...prev, [selectedPresetId]: selectedTemplateId }
      writeStoredReferenceTemplates(next)
      return next
    })
  }, [selectedPresetId, selectedTemplateId, referenceTemplateByPreset])

  useEffect(() => {
    if (!selectedPresetId && !selectedTemplateId) return
    if (
      selectedPresetId === presetId &&
      selectedTemplateId === templateId
    ) {
      return
    }

    void navigate({
      search: (prev) => ({
        ...prev,
        presetId: selectedPresetId,
        templateId: selectedTemplateId,
      }),
      replace: true,
    })
  }, [
    navigate,
    presetId,
    templateId,
    selectedPresetId,
    selectedTemplateId,
  ])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [columns, setColumns] = useState<Array<MetadataExportColumnConfigT>>([])
  const [alignedPresetId, setAlignedPresetId] = useState<string | undefined>(
    undefined,
  )
  const [alignedTemplateId, setAlignedTemplateId] = useState<string | undefined>(
    undefined,
  )

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

  const columnsRef = useRef(columns)
  columnsRef.current = columns

  // Session drafts keyed by preset + reference template so presets never share edits.
  const columnsDraftRef = useRef<
    Record<string, Array<MetadataExportColumnConfigT>>
  >({})

  const createMutation = useCreateMetadataExportPreset()
  const updateMutation = useUpdateMetadataExportPreset()
  const deleteMutation = useDeleteMetadataExportPreset()

  const presetResetId = selectedPreset?.id

  useEffect(() => {
    if (!presetResetId || !selectedPreset || selectedPreset.id !== presetResetId) {
      setName('')
      setDescription('')
      setColumns([])
      setAlignedPresetId(undefined)
      setAlignedTemplateId(undefined)
      setColumnErrors({})
      return
    }

    setName(selectedPreset.name)
    setDescription(selectedPreset.description)
    setColumnErrors({})
  }, [presetResetId])

  useEffect(() => {
    if (!selectedPreset || !selectedTemplateId || !selectedTemplate) return

    const samePreset = alignedPresetId === selectedPreset.id
    const sameTemplate = alignedTemplateId === selectedTemplateId
    if (samePreset && sameTemplate) return

    if (alignedPresetId && alignedTemplateId) {
      columnsDraftRef.current[draftKey(alignedPresetId, alignedTemplateId)] =
        cloneColumns(columnsRef.current)
    }

    const key = draftKey(selectedPreset.id, selectedTemplateId)
    const cached = columnsDraftRef.current[key]
    if (cached) {
      setColumns(cloneColumns(cached))
    } else if (!samePreset) {
      // Load persisted columns as-is. Do not prune by reference catalog —
      // that catalog is only for picking fields and may differ after reload.
      const initial = cloneColumns(selectedPreset.columns)
      columnsDraftRef.current[key] = initial
      setColumns(initial)
    } else {
      // Same preset, different reference template, no draft yet: keep edits.
      const kept = cloneColumns(columnsRef.current)
      columnsDraftRef.current[key] = kept
      setColumns(kept)
    }

    setColumnErrors({})
    setAlignedPresetId(selectedPreset.id)
    setAlignedTemplateId(selectedTemplateId)
  }, [
    selectedPreset,
    selectedTemplateId,
    selectedTemplate,
    alignedPresetId,
    alignedTemplateId,
  ])

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
    if (selectedPreset && selectedTemplateId) {
      columnsDraftRef.current[draftKey(selectedPreset.id, selectedTemplateId)] =
        nextColumns
    }
    setColumnErrors({})
  }

  function handleNameChange(value: string) {
    setName(value)
    if (value.trim()) {
      setNameError(false)
    }
  }

  function selectPreset(nextPresetId: string) {
    const nextPreset = presets.find((item) => item.id === nextPresetId)
    const nextTemplateId = resolveTemplateIdForPreset({
      presetId: nextPresetId,
      presetColumns: nextPreset?.columns,
      templates,
      rememberedByPreset: referenceTemplateByPreset,
    })

    if (nextTemplateId) {
      rememberReferenceTemplate(nextPresetId, nextTemplateId)
    }

    void navigate({
      search: (prev) => ({
        ...prev,
        presetId: nextPresetId,
        templateId: nextTemplateId,
      }),
    })
  }

  function selectTemplate(nextTemplateId: string) {
    if (selectedPresetId) {
      rememberReferenceTemplate(selectedPresetId, nextTemplateId)
    }
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
      const savedColumns = cloneColumns(columns)
      const updated = await updateMutation.mutateAsync({
        presetId: selectedPreset.id,
        payload: {
          name: name.trim(),
          description: description.trim() || null,
          columns: savedColumns,
        },
      })

      setName(updated.name)
      setDescription(updated.description)
      const nextColumns = cloneColumns(updated.columns)
      setColumns(nextColumns)
      if (selectedTemplateId) {
        columnsDraftRef.current[draftKey(updated.id, selectedTemplateId)] =
          nextColumns
      }
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
        columns: [
          {
            header: t('metadataExport.defaultColumnHeader'),
            fieldKeys: [],
            separator: ', ',
          },
        ],
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
                    <SelectValue
                      placeholder={t('metadataExport.referenceTemplatePlaceholder')}
                    />
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

              {isLoadingTemplates ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('metadataExport.loadingFields')}
                </div>
              ) : (
                <MetadataExportColumnEditor
                  key={`${selectedPreset.id}:${selectedTemplateId ?? 'no-template'}`}
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
