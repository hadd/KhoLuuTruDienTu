import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { AlertTriangle, Eye, Loader2, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { activeArchiveFondsQueryOptions } from '@/features/archive-fond/queries'
import { DataConfigSectionTabs } from '@/features/data-config/components/DataConfigSectionTabs'
import { NamingSegmentTable } from '@/features/document-naming-config/components/NamingSegmentTable'
import {
  bulkApplyOnApproveStatusQueryOptions,
  documentNamingConfigQueryOptions,
  documentNamingDossierMetadataFieldsQueryOptions,
  documentNamingFieldCatalogQueryOptions,
  useBulkUpdateApplyOnApprove,
  usePreviewDocumentNamingConfig,
  useUpdateFondApplyOnApprove,
  useUpsertDocumentNamingConfig,
} from '@/features/document-naming-config/queries'
import type {
  DocumentNamingSearchT,
  NamingSegmentFieldErrorT,
} from '@/features/document-naming-config/schemas'
import { validateDocumentNamingSegments } from '@/features/document-naming-config/schemas'
import type { DocumentNamingSegmentT } from '@/features/document-naming-config/types'
import {
  sectionBoxedSubTabsListClassName,
  sectionBoxedSubTabsTriggerClassName,
} from '@/features/navigation/components/SectionBackNav'
import { cn } from '@/lib/utils/cn'

const routeApi = getRouteApi('/app/data-config/document-naming')

export function DocumentNamingConfigPage() {
  const { t } = useTranslation('document-naming-config')
  const navigate = routeApi.useNavigate()
  const search: DocumentNamingSearchT = routeApi.useSearch()

  const fondId = search.fondId ?? ''

  const activeTab: 'general' | 'fond' =
    search.tab ?? (search.fondId ? 'fond' : 'general')

  const handleTabChange = (nextTab: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        tab: nextTab as 'general' | 'fond',
      }),
    })
  }

  // General tab states
  const bulkStatusQuery = useQuery(bulkApplyOnApproveStatusQueryOptions())
  const bulkUpdateMutation = useBulkUpdateApplyOnApprove()
  const [bulkApplyOnApprove, setBulkApplyOnApprove] = useState<boolean>(false)

  useEffect(() => {
    if (bulkStatusQuery.data?.applyOnApprove !== undefined) {
      setBulkApplyOnApprove(bulkStatusQuery.data.applyOnApprove)
    }
  }, [bulkStatusQuery.data?.applyOnApprove])

  // Fond tab states
  const [dossierSegments, setDossierSegments] = useState<
    Array<DocumentNamingSegmentT>
  >([])
  const [fileSegments, setFileSegments] = useState<
    Array<DocumentNamingSegmentT>
  >([])
  const [dossierPreviewItems, setDossierPreviewItems] = useState<Array<string>>(
    [],
  )
  const [filePreviewItems, setFilePreviewItems] = useState<Array<string>>([])
  const [dossierSegmentErrors, setDossierSegmentErrors] = useState<
    Array<NamingSegmentFieldErrorT>
  >([])
  const [fileSegmentErrors, setFileSegmentErrors] = useState<
    Array<NamingSegmentFieldErrorT>
  >([])
  const [fileApplyOnApprove, setFileApplyOnApprove] = useState<boolean>(false)

  const fondsQuery = useQuery(activeArchiveFondsQueryOptions())
  const fieldCatalogQuery = useQuery(documentNamingFieldCatalogQueryOptions(null))
  const dossierConfigQuery = useQuery(
    documentNamingConfigQueryOptions(
      fondId ? { fondId, targetType: 'dossier' } : null,
    ),
  )
  const fileConfigQuery = useQuery(
    documentNamingConfigQueryOptions(
      fondId ? { fondId, targetType: 'file' } : null,
    ),
  )
  const metadataFieldsQuery = useQuery(
    documentNamingDossierMetadataFieldsQueryOptions(undefined),
  )

  const upsertMutation = useUpsertDocumentNamingConfig()
  const previewMutation = usePreviewDocumentNamingConfig()
  const updateFondApplyMutation = useUpdateFondApplyOnApprove()

  const fonds = fondsQuery.data?.items ?? []
  const fieldCatalog = fieldCatalogQuery.data ?? {
    fond: [],
    dossier: [],
    file: [],
    metadata: [],
  }
  const metadataFields = metadataFieldsQuery.data?.fields ?? []
  const isFallbackMetadata = metadataFieldsQuery.data?.isFallback ?? false

  // Track which fondId has been initialized into local form state
  const initializedFondIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!fondId) {
      initializedFondIdRef.current = null
      setDossierSegments([])
      setFileSegments([])
      setFileApplyOnApprove(false)
      setDossierPreviewItems([])
      setFilePreviewItems([])
      setDossierSegmentErrors([])
      setFileSegmentErrors([])
      return
    }

    // Only populate form state when switching to a new fondId or on first load of that fondId
    if (initializedFondIdRef.current !== fondId) {
      if (dossierConfigQuery.data) {
        setDossierSegments(dossierConfigQuery.data.segments ?? [])
        setDossierPreviewItems([])
        setDossierSegmentErrors([])
      }
      if (fileConfigQuery.data) {
        setFileSegments(fileConfigQuery.data.segments ?? [])
        setFileApplyOnApprove(fileConfigQuery.data.applyOnApprove ?? false)
        setFilePreviewItems([])
        setFileSegmentErrors([])
      }
      if (dossierConfigQuery.data && fileConfigQuery.data) {
        initializedFondIdRef.current = fondId
      }
    }
  }, [fondId, dossierConfigQuery.data, fileConfigQuery.data])

  const handleFondChange = (nextFondId: string) => {
    initializedFondIdRef.current = null
    void navigate({
      search: (prev) => ({
        ...prev,
        tab: 'fond',
        fondId: nextFondId || undefined,
        dossierId: undefined,
      }),
    })
  }

  const handleDossierSegmentsChange = (
    segments: Array<DocumentNamingSegmentT>,
  ) => {
    setDossierSegments(segments)
    setDossierPreviewItems([])
    if (dossierSegmentErrors.length > 0) {
      setDossierSegmentErrors(
        validateDocumentNamingSegments(segments, 'dossier'),
      )
    }
  }

  const handleFileSegmentsChange = (
    segments: Array<DocumentNamingSegmentT>,
  ) => {
    setFileSegments(segments)
    setFilePreviewItems([])
    if (fileSegmentErrors.length > 0) {
      setFileSegmentErrors(validateDocumentNamingSegments(segments, 'file'))
    }
  }

  const handleBulkApplySwitchChange = async (checked: boolean) => {
    setBulkApplyOnApprove(checked)
    try {
      await bulkUpdateMutation.mutateAsync({
        applyOnApprove: checked,
      })
      toast.success(t('general.saveSuccess'))
    } catch (error) {
      setBulkApplyOnApprove(!checked)
      toast.error(
        error instanceof Error ? error.message : t('errors.saveFailed'),
      )
    }
  }

  const handleFileApplySwitchChange = async (checked: boolean) => {
    if (!fondId) return
    setFileApplyOnApprove(checked)
    try {
      await updateFondApplyMutation.mutateAsync({
        fondId,
        applyOnApprove: checked,
      })
      toast.success(
        checked
          ? 'Đã bật tự động đổi tên file PDF khi duyệt cho phông này'
          : 'Đã tắt tự động đổi tên file PDF khi duyệt cho phông này',
      )
    } catch (error) {
      setFileApplyOnApprove(!checked)
      toast.error(
        error instanceof Error ? error.message : t('errors.saveFailed'),
      )
    }
  }

  const handleSaveBulkApply = async () => {
    try {
      await bulkUpdateMutation.mutateAsync({
        applyOnApprove: bulkApplyOnApprove,
      })
      toast.success(t('general.saveSuccess'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('errors.saveFailed'),
      )
    }
  }

  const handleSaveDossierConfig = async () => {
    if (!fondId) return

    const errors = validateDocumentNamingSegments(dossierSegments, 'dossier')
    setDossierSegmentErrors(errors)
    if (errors.length > 0) {
      toast.error(errors[0]?.message ?? t('errors.segmentsRequired'))
      return
    }

    try {
      await upsertMutation.mutateAsync({
        fondId,
        targetType: 'dossier',
        segments: dossierSegments,
      })
      toast.success(t('form.success.dossier'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('errors.saveFailed'),
      )
    }
  }

  const handlePreviewDossierConfig = async () => {
    if (!fondId) return

    const errors = validateDocumentNamingSegments(dossierSegments, 'dossier')
    setDossierSegmentErrors(errors)
    if (errors.length > 0) {
      toast.error(errors[0]?.message ?? t('errors.segmentsRequired'))
      return
    }

    try {
      const result = await previewMutation.mutateAsync({
        fondId,
        targetType: 'dossier',
        segments: dossierSegments,
      })
      setDossierPreviewItems(result.previews)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('errors.previewFailed'),
      )
    }
  }

  const handleSaveFileConfig = async () => {
    if (!fondId) return

    const errors = validateDocumentNamingSegments(fileSegments, 'file')
    setFileSegmentErrors(errors)
    if (errors.length > 0) {
      toast.error(errors[0]?.message ?? t('errors.segmentsRequired'))
      return
    }

    try {
      await upsertMutation.mutateAsync({
        fondId,
        targetType: 'file',
        segments: fileSegments,
        applyOnApprove: fileApplyOnApprove,
      })
      toast.success(t('form.success.file'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('errors.saveFailed'),
      )
    }
  }

  const handlePreviewFileConfig = async () => {
    if (!fondId) return

    const errors = validateDocumentNamingSegments(fileSegments, 'file')
    setFileSegmentErrors(errors)
    if (errors.length > 0) {
      toast.error(errors[0]?.message ?? t('errors.segmentsRequired'))
      return
    }

    try {
      const result = await previewMutation.mutateAsync({
        fondId,
        targetType: 'file',
        segments: fileSegments,
      })
      setFilePreviewItems(result.previews)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('errors.previewFailed'),
      )
    }
  }

  const isFondLoading =
    fondsQuery.isLoading ||
    (Boolean(fondId) &&
      (dossierConfigQuery.isLoading || fileConfigQuery.isLoading))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DataConfigSectionTabs active="document-naming" />

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="mt-3.5 flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <TabsList className={cn(sectionBoxedSubTabsListClassName, 'shrink-0')}>
          <TabsTrigger
            value="general"
            className={sectionBoxedSubTabsTriggerClassName}
          >
            {t('subTabs.general')}
          </TabsTrigger>
          <TabsTrigger
            value="fond"
            className={sectionBoxedSubTabsTriggerClassName}
          >
            {t('subTabs.byFond')}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="general"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          {bulkStatusQuery.isLoading ? (
            <div className="flex min-h-[240px] flex-1 items-center justify-center p-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex max-w-3xl flex-col gap-6 p-6">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  {t('general.title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('general.description')}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label
                      htmlFor="bulk-apply-switch"
                      className="text-base font-medium cursor-pointer"
                    >
                      {t('general.bulkApplyOnApproveTitle')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('general.bulkApplyOnApproveDesc')}
                    </p>
                  </div>
                  <Switch
                    id="bulk-apply-switch"
                    checked={bulkApplyOnApprove}
                    onCheckedChange={(checked) => void handleBulkApplySwitchChange(checked)}
                    disabled={bulkUpdateMutation.isPending}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('general.status', {
                      enabledCount: bulkStatusQuery.data?.enabledCount ?? 0,
                      totalFonds: bulkStatusQuery.data?.totalFonds ?? 0,
                    })}
                  </p>
                  <Button
                    type="button"
                    disabled={bulkUpdateMutation.isPending}
                    onClick={() => void handleSaveBulkApply()}
                  >
                    {bulkUpdateMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Save className="size-4" aria-hidden />
                    )}
                    {t('general.saveBulkApply')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="fond"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          {isFondLoading ? (
            <div className="flex min-h-[300px] flex-1 items-center justify-center p-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-8 pb-6">
              <div className="max-w-md space-y-2 pt-4">
                <Label>{t('fond.label')}</Label>
                <Select value={fondId} onValueChange={handleFondChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('fond.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {fonds.map((fond) => (
                      <SelectItem key={fond.id} value={fond.id}>
                        {fond.fondName} ({fond.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {fondId ? (
                <>
                  {/* Section: Quy tắc sinh tên hồ sơ */}
                  <section className="space-y-4 rounded-lg border border-transparent p-4">
                    <NamingSegmentTable
                      title={t('segments.dossierTitle')}
                      targetType="dossier"
                      segments={dossierSegments}
                      fieldCatalog={fieldCatalog}
                      metadataFields={metadataFields}
                      isFallbackMetadata={isFallbackMetadata}
                      disabled={upsertMutation.isPending}
                      errors={dossierSegmentErrors}
                      onChange={handleDossierSegmentsChange}
                    />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={previewMutation.isPending}
                        onClick={() => void handlePreviewDossierConfig()}
                      >
                        <Eye className="size-4" aria-hidden />
                        {t('form.actions.preview')}
                      </Button>
                      <Button
                        type="button"
                        disabled={upsertMutation.isPending}
                        onClick={() => void handleSaveDossierConfig()}
                      >
                        <Save className="size-4" aria-hidden />
                        {t('form.actions.saveDossier')}
                      </Button>
                    </div>

                    {dossierPreviewItems.length > 0 ? (
                      <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                        <p className="text-sm font-medium">
                          {t('preview.label')}
                        </p>
                        <ul className="space-y-1">
                          {dossierPreviewItems.map((previewItem, index) => (
                            <li
                              key={`dossier-preview-${index}`}
                              className="font-mono text-sm text-foreground"
                            >
                              {dossierPreviewItems.length > 1
                                ? `${t('preview.sample', { index: index + 1 })} ${previewItem}`
                                : previewItem}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>

                  {/* Section: Quy tắc sinh tên file (cấp phông) */}
                  <section className="space-y-4 rounded-lg border border-border p-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-foreground">
                        {t('fileNaming.title')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t('fileNaming.description')}
                      </p>
                    </div>

                    {fileConfigQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        {t('fileNaming.loading')}
                      </div>
                    ) : (
                      <NamingSegmentTable
                        title={t('segments.fileTitle')}
                        targetType="file"
                        segments={fileSegments}
                        fieldCatalog={fieldCatalog}
                        metadataFields={metadataFields}
                        isFallbackMetadata={isFallbackMetadata}
                        disabled={upsertMutation.isPending}
                        errors={fileSegmentErrors}
                        onChange={handleFileSegmentsChange}
                      />
                    )}

                    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-xs">
                      <div className="space-y-0.5 pr-4">
                        <Label
                          htmlFor="apply-on-approve-switch"
                          className="text-sm font-medium cursor-pointer"
                        >
                          {t('fileNaming.applyOnApprove')}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t('fileNaming.applyOnApproveHint')}
                        </p>
                      </div>
                      <Switch
                        id="apply-on-approve-switch"
                        checked={fileApplyOnApprove}
                        onCheckedChange={(checked) => void handleFileApplySwitchChange(checked)}
                        disabled={updateFondApplyMutation.isPending || upsertMutation.isPending}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={previewMutation.isPending}
                        onClick={() => void handlePreviewFileConfig()}
                      >
                        <Eye className="size-4" aria-hidden />
                        {t('form.actions.preview')}
                      </Button>
                      <Button
                        type="button"
                        disabled={upsertMutation.isPending}
                        onClick={() => void handleSaveFileConfig()}
                      >
                        <Save className="size-4" aria-hidden />
                        {t('form.actions.saveFile')}
                      </Button>
                    </div>

                    {filePreviewItems.length > 0 ? (
                      <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                        <p className="text-sm font-medium">
                          {t('preview.label')}
                        </p>
                        <ul className="space-y-1">
                          {filePreviewItems.map((previewItem, index) => (
                            <li
                              key={`file-preview-${index}`}
                              className="font-mono text-sm text-foreground"
                            >
                              {filePreviewItems.length > 1
                                ? `${t('preview.sample', { index: index + 1 })} ${previewItem}`
                                : previewItem}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                </>
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
