import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Eye, Loader2, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { activeArchiveFondsQueryOptions } from '@/features/archive-fond/queries'
import { NamingSegmentTable } from '@/features/document-naming-config/components/NamingSegmentTable'
import {
  documentNamingConfigQueryOptions,
  documentNamingDossierOptionsQueryOptions,
  documentNamingFieldCatalogQueryOptions,
  usePreviewDocumentNamingConfig,
  useUpsertDocumentNamingConfig,
} from '@/features/document-naming-config/queries'
import type { DocumentNamingSegmentT } from '@/features/document-naming-config/types'

const routeApi = getRouteApi('/app/data-config/document-naming')

export function DocumentNamingConfigPage() {
  const { t } = useTranslation('document-naming-config')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()

  const fondId = search.fondId ?? ''
  const dossierId = search.dossierId ?? ''

  const [dossierSearch, setDossierSearch] = useState('')
  const [dossierSegments, setDossierSegments] = useState<Array<DocumentNamingSegmentT>>([])
  const [fileSegments, setFileSegments] = useState<Array<DocumentNamingSegmentT>>([])
  const [previewText, setPreviewText] = useState<string | null>(null)

  const fondsQuery = useQuery(activeArchiveFondsQueryOptions)
  const fieldCatalogQuery = useQuery(documentNamingFieldCatalogQueryOptions())
  const dossierConfigQuery = useQuery(
    documentNamingConfigQueryOptions(
      fondId
        ? { fondId, targetType: 'dossier' }
        : null,
    ),
  )
  const fileConfigQuery = useQuery(
    documentNamingConfigQueryOptions(
      fondId && dossierId
        ? { fondId, targetType: 'file', dossierId }
        : null,
    ),
  )
  const dossierOptionsQuery = useQuery(
    documentNamingDossierOptionsQueryOptions(
      fondId ? { fondId, search: dossierSearch || undefined } : null,
    ),
  )

  const upsertMutation = useUpsertDocumentNamingConfig()
  const previewMutation = usePreviewDocumentNamingConfig()

  const fonds = fondsQuery.data ?? []
  const fieldCatalog = fieldCatalogQuery.data ?? {
    fond: [],
    dossier: [],
    file: [],
  }
  const dossierOptions = dossierOptionsQuery.data ?? []

  useEffect(() => {
    setDossierSegments(dossierConfigQuery.data?.segments ?? [])
  }, [dossierConfigQuery.data?.segments, fondId])

  useEffect(() => {
    setFileSegments(fileConfigQuery.data?.segments ?? [])
    setPreviewText(null)
  }, [fileConfigQuery.data?.segments, fondId, dossierId])

  const selectedDossier = useMemo(
    () => dossierOptions.find((item) => item.id === dossierId) ?? null,
    [dossierOptions, dossierId],
  )

  const handleFondChange = (nextFondId: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        fondId: nextFondId || undefined,
        dossierId: undefined,
      }),
    })
  }

  const handleDossierChange = (nextDossierId: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        dossierId: nextDossierId || undefined,
      }),
    })
  }

  const handleSaveDossierConfig = async () => {
    if (!fondId) return
    if (dossierSegments.length === 0) {
      toast.error(t('errors.segmentsRequired'))
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

  const handleSaveFileConfig = async () => {
    if (!fondId || !dossierId) return
    if (fileSegments.length === 0) {
      toast.error(t('errors.segmentsRequired'))
      return
    }

    try {
      await upsertMutation.mutateAsync({
        fondId,
        targetType: 'file',
        dossierId,
        segments: fileSegments,
      })
      toast.success(t('form.success.file'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('errors.saveFailed'),
      )
    }
  }

  const handlePreviewFileConfig = async () => {
    if (!fondId || !dossierId || fileSegments.length === 0) return

    try {
      const result = await previewMutation.mutateAsync({
        fondId,
        targetType: 'file',
        dossierId,
        segments: fileSegments,
      })
      setPreviewText(result.preview)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('errors.previewFailed'),
      )
    }
  }

  const isLoading =
    fondsQuery.isLoading ||
    fieldCatalogQuery.isLoading ||
    (Boolean(fondId) && dossierConfigQuery.isLoading)

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <DataConfigSectionTabs active="document-naming" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('fond.title')}</CardTitle>
          <CardDescription>{t('fond.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
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
        </CardContent>
      </Card>

      {fondId ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('dossierNaming.title')}</CardTitle>
            <CardDescription>{t('dossierNaming.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <NamingSegmentTable
              segments={dossierSegments}
              fieldCatalog={fieldCatalog}
              disabled={upsertMutation.isPending}
              onChange={setDossierSegments}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={upsertMutation.isPending}
                onClick={() => void handleSaveDossierConfig()}
              >
                <Save className="size-4" aria-hidden />
                {t('form.actions.saveDossier')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {fondId ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('fileNaming.title')}</CardTitle>
            <CardDescription>{t('fileNaming.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('fileNaming.dossierSearch')}</Label>
                <Input
                  value={dossierSearch}
                  placeholder={t('fileNaming.dossierSearchPlaceholder')}
                  onChange={(event) => setDossierSearch(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('fileNaming.dossierLabel')}</Label>
                <Select value={dossierId} onValueChange={handleDossierChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('fileNaming.dossierPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {dossierOptions.map((dossier) => (
                      <SelectItem key={dossier.id} value={dossier.id}>
                        {dossier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {dossierId ? (
              <>
                {selectedDossier ? (
                  <p className="text-sm text-muted-foreground">
                    {t('fileNaming.selectedDossier', {
                      name: selectedDossier.name,
                      path: selectedDossier.folderPath,
                    })}
                  </p>
                ) : null}

                {fileConfigQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {t('fileNaming.loading')}
                  </div>
                ) : (
                  <NamingSegmentTable
                    segments={fileSegments}
                    fieldCatalog={fieldCatalog}
                    disabled={upsertMutation.isPending}
                    onChange={setFileSegments}
                  />
                )}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={previewMutation.isPending || fileSegments.length === 0}
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

                {previewText ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <p className="text-sm font-medium">{t('preview.label')}</p>
                    <p className="mt-1 font-mono text-sm text-foreground">
                      {previewText}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('fileNaming.selectDossierHint')}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
