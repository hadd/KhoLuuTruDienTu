import { useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DossierPickerDialog } from '@/features/data-config/components/DossierPickerDialog'
import { MetadataGroupReadOnlyTree } from '@/features/data-config/components/MetadataGroupReadOnlyTree'
import { dataConfigStore, useDataConfigStore } from '@/features/data-config/store'

const routeApi = getRouteApi('/app/data-config/document-types')

export function DocumentTypeConfigPage() {
  const { t } = useTranslation('data-config')
  const navigate = routeApi.useNavigate()
  const { templateId } = routeApi.useSearch()
  const templates = useDataConfigStore((s) => s.templates)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const selectedTemplateId =
    templateId && templates.some((t) => t.id === templateId)
      ? templateId
      : templates[0]?.id

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  useEffect(() => {
    if (templates.length === 0) return

    const resolvedId =
      templateId && templates.some((t) => t.id === templateId)
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

  const handleDeleteTemplate = () => {
    if (!selectedTemplate) return
    dataConfigStore.removeTemplate(selectedTemplate.id)
    toast.success(t('delete.templateSuccess'))
    setDeleteOpen(false)

    const remaining = templates.filter((t) => t.id !== selectedTemplate.id)
    void navigate({
      search: (prev) => ({
        ...prev,
        templateId: remaining[0]?.id,
      }),
    })
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

        <div className="flex flex-wrap items-center gap-2">
          {templates.length > 0 ? (
            <Select
              value={selectedTemplateId}
              onValueChange={handleSelectTemplate}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={t('documentTypes.actions.selectTemplate')} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Button
            type="button"
            variant="outline"
            disabled={!selectedTemplate}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            {t('documentTypes.actions.deleteTemplate')}
          </Button>
        </div>
      </div>

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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.templateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.templateDescription', {
                name: selectedTemplate?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete.cancelButton')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>
              {t('delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
