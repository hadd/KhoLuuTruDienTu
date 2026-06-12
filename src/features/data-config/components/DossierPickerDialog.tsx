import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { filterDossierOptions } from '@/features/data-config/lib/metadataTemplateHelpers'
import {
  metadataTemplateDossierOptionsQueryOptions,
  useCreateMetadataTemplate,
} from '@/features/data-config/queries'
import type { MetadataTemplateDossierOptionT } from '@/features/data-config/types'
import { cn } from '@/lib/utils/cn'

interface DossierPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (templateId: string) => void
}

export function DossierPickerDialog({
  open,
  onOpenChange,
  onSaved,
}: DossierPickerDialogProps) {
  const { t } = useTranslation('data-config')
  const [selectedDossier, setSelectedDossier] =
    useState<MetadataTemplateDossierOptionT | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')

  const { data: dossierOptions = [], isLoading } = useQuery({
    ...metadataTemplateDossierOptionsQueryOptions(),
    enabled: open,
  })

  const createMutation = useCreateMetadataTemplate()

  const filteredOptions = useMemo(
    () => filterDossierOptions(dossierOptions, search),
    [dossierOptions, search],
  )
  const listScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const scrollContainer = listScrollRef.current
    if (!scrollContainer) return

    const handleWheel = (event: WheelEvent) => {
      if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) return
      event.stopPropagation()
      event.preventDefault()
      scrollContainer.scrollTop += event.deltaY
    }

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false })
    return () => scrollContainer.removeEventListener('wheel', handleWheel)
  }, [open, filteredOptions.length, isLoading])

  const resetForm = () => {
    setSelectedDossier(null)
    setTemplateName('')
    setDescription('')
    setSearch('')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  const handleSave = async () => {
    const trimmedName = templateName.trim()

    if (!trimmedName) {
      toast.error(t('errors.templateNameRequired'))
      return
    }

    if (!selectedDossier) {
      toast.error(t('errors.noDossierSelected'))
      return
    }

    const created = await createMutation.mutateAsync({
      name: trimmedName,
      description: description.trim(),
      dossierId: selectedDossier.id,
    })

    handleOpenChange(false)
    onSaved(created.id)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('documentTypes.picker.title')}</DialogTitle>
          <DialogDescription>
            {t('documentTypes.picker.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-2">
          <Label htmlFor="template-name">
            {t('documentTypes.picker.nameLabel')}{' '}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="template-name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={t('documentTypes.picker.namePlaceholder')}
            autoFocus
            className="w-full"
          />
        </div>

        <div className="shrink-0 space-y-2">
          <Label htmlFor="template-description">
            {t('documentTypes.picker.descriptionLabel')}
          </Label>
          <Input
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('documentTypes.picker.descriptionPlaceholder')}
            className="w-full"
          />
        </div>

        <div className="shrink-0 space-y-2">
          <Label htmlFor="dossier-search">
            {t('documentTypes.picker.searchLabel')}
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="dossier-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('documentTypes.picker.searchPlaceholder')}
              className="w-full pl-9"
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {t('documentTypes.picker.selectHint')}
          </p>

          <div
            ref={listScrollRef}
            className="h-[min(40vh,16rem)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card pr-2"
          >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOptions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {t('documentTypes.picker.emptyDossiers')}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filteredOptions.map((option) => {
                const isSelected = selectedDossier?.id === option.id

                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedDossier(option)}
                      className={cn(
                        'flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors',
                        isSelected
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-muted/60',
                      )}
                    >
                      <span className="text-sm font-medium">{option.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.folderPath}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={createMutation.isPending}
          >
            {t('documentTypes.picker.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={
              !selectedDossier ||
              !templateName.trim() ||
              createMutation.isPending
            }
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {t('documentTypes.picker.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
