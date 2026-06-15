import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DossierPickerDialog } from '@/features/data-config/components/DossierPickerDialog'
import { MetadataGroupReadOnlyTree } from '@/features/data-config/components/MetadataGroupReadOnlyTree'
import { TemplateEditDialog } from '@/features/data-config/components/TemplateEditDialog'
import { metadataTemplatesQueryOptions } from '@/features/data-config/queries'

const routeApi = getRouteApi('/app/data-config/document-types')

export function DocumentTypeConfigPage() {
  const { t } = useTranslation('data-config')
  const navigate = routeApi.useNavigate()
  const { templateId } = routeApi.useSearch()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const { data: templates = [], isLoading, isError } = useQuery(
    metadataTemplatesQueryOptions(),
  )

  const selectedTemplateId =
    templateId && templates.some((item) => item.id === templateId)
      ? templateId
      : templates[0]?.id

  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId)

  useEffect(() => {
    if (templates.length === 0) return

    const resolvedId =
      templateId && templates.some((item) => item.id === templateId)
        ? templateId
        : templates[0]?.id

    if (resolvedId && resolvedId !== templateId) {
      void navigate({
        search: (prev) => ({ ...prev, templateId: resolvedId }),
        replace: true,
      })
    }
  }, [templateId, templates, navigate])

  const handleSelectTemplate = (nextTemplateId: string) => {
    void navigate({
      search: (prev) => ({ ...prev, templateId: nextTemplateId }),
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
        <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold text-foreground">
          {t('documentTypes.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('documentTypes.description')}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <Button type="button" onClick={() => setPickerOpen(true)}>
          <Plus className="size-4" />
          {t('documentTypes.actions.addData')}
        </Button>

        {templates.length > 0 ? (
          <div className="flex items-center gap-2">
            <Select
              value={selectedTemplateId}
              onValueChange={handleSelectTemplate}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder={t('documentTypes.actions.selectTemplate')} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <span className="truncate">{template.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('documentTypes.actions.editTemplate')}
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {selectedTemplate?.description ? (
        <p className="shrink-0 text-sm text-muted-foreground">
          {selectedTemplate.description}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-card p-4">
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('documentTypes.empty.noTemplate')}
          </p>
        ) : selectedTemplate ? (
          <MetadataGroupReadOnlyTree groups={selectedTemplate.groups} />
        ) : null}
      </div>

      <DossierPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSaved={(newTemplateId) => {
          void navigate({
            search: (prev) => ({ ...prev, templateId: newTemplateId }),
          })
        }}
      />

      <TemplateEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        template={selectedTemplate ?? null}
      />
    </div>
  )
}
