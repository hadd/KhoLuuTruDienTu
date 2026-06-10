import { useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
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
import { MetadataFieldCheckboxTree } from '@/features/data-config/components/MetadataFieldCheckboxTree'
import { dataConfigStore, useDataConfigStore } from '@/features/data-config/store'
import type { AssignmentLevelT } from '@/features/data-config/types'
import { cn } from '@/lib/utils/cn'

const routeApi = getRouteApi('/app/data-config/document-assignment')

export function DocumentAssignmentConfigPage() {
  const { t } = useTranslation('data-config')
  const navigate = routeApi.useNavigate()
  const { templateId, levelId } = routeApi.useSearch()
  const templates = useDataConfigStore((s) => s.templates)
  const assignmentsByTemplateId = useDataConfigStore(
    (s) => s.assignmentsByTemplateId,
  )

  const [addLevelOpen, setAddLevelOpen] = useState(false)
  const [levelName, setLevelName] = useState('')
  const [levelToDelete, setLevelToDelete] = useState<AssignmentLevelT | null>(
    null,
  )

  const selectedTemplateId =
    templateId && templates.some((t) => t.id === templateId)
      ? templateId
      : templates[0]?.id

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)
  const assignment = selectedTemplateId
    ? assignmentsByTemplateId[selectedTemplateId]
    : undefined
  const levels = assignment?.levels ?? []

  const selectedLevelId =
    levelId && levels.some((l) => l.id === levelId)
      ? levelId
      : levels[0]?.id

  const allowedFields =
    selectedTemplateId && selectedLevelId
      ? (assignment?.fieldKeysByLevelId[selectedLevelId] ?? [])
      : []

  useEffect(() => {
    if (templates.length === 0) return

    const resolvedTemplateId =
      templateId && templates.some((t) => t.id === templateId)
        ? templateId
        : templates[0]?.id

    if (resolvedTemplateId && resolvedTemplateId !== templateId) {
      void navigate({
        search: (prev) => ({
          ...prev,
          templateId: resolvedTemplateId,
          levelId: undefined,
        }),
        replace: true,
      })
    }
  }, [templateId, templates, navigate])

  useEffect(() => {
    if (!selectedTemplateId || levels.length === 0) return

    const resolvedLevelId =
      levelId && levels.some((l) => l.id === levelId)
        ? levelId
        : levels[0]?.id

    if (resolvedLevelId && resolvedLevelId !== levelId) {
      void navigate({
        search: (prev) => ({
          ...prev,
          levelId: resolvedLevelId,
        }),
        replace: true,
      })
    }
  }, [levelId, levels, selectedTemplateId, navigate])

  const handleSelectTemplate = (nextTemplateId: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        templateId: nextTemplateId,
        levelId: undefined,
      }),
    })
  }

  const handleSelectLevel = (nextLevelId: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        levelId: nextLevelId,
      }),
    })
  }

  const handleAddLevel = () => {
    const trimmed = levelName.trim()
    if (!trimmed || !selectedTemplateId) return

    const newLevel = dataConfigStore.addLevel(selectedTemplateId, trimmed)
    setLevelName('')
    setAddLevelOpen(false)
    void navigate({
      search: (prev) => ({
        ...prev,
        levelId: newLevel.id,
      }),
    })
  }

  const handleDeleteLevel = () => {
    if (!levelToDelete || !selectedTemplateId) return

    dataConfigStore.removeLevel(selectedTemplateId, levelToDelete.id)
    toast.success(t('delete.levelSuccess'))
    setLevelToDelete(null)

    const remaining = levels.filter((l) => l.id !== levelToDelete.id)
    void navigate({
      search: (prev) => ({
        ...prev,
        levelId: remaining[0]?.id,
      }),
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold text-foreground">
          {t('documentAssignment.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('documentAssignment.description')}
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-border bg-muted/30 p-8">
          <p className="text-sm text-muted-foreground">
            {t('documentAssignment.empty.noTemplate')}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-border">
          <section className="flex w-52 shrink-0 flex-col border-r border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium text-foreground">
                {t('documentAssignment.columns.template')}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {templates.map((template) => {
                const isSelected = template.id === selectedTemplateId

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/50',
                    )}
                  >
                    <span className="truncate font-medium">{template.name}</span>
                    {isSelected ? (
                      <ChevronRight className="size-4 shrink-0" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium text-foreground">
                {t('documentAssignment.columns.level')}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={!selectedTemplateId}
                onClick={() => setAddLevelOpen(true)}
                aria-label={t('documentAssignment.levels.add')}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {!selectedTemplateId ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  {t('documentAssignment.empty.selectTemplate')}
                </p>
              ) : levels.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  {t('documentAssignment.levels.empty')}
                </p>
              ) : (
                levels.map((level) => {
                  const isSelected = level.id === selectedLevelId

                  return (
                    <div
                      key={level.id}
                      className={cn(
                        'flex items-center gap-1 rounded-md',
                        isSelected && 'bg-accent/50',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectLevel(level.id)}
                        className={cn(
                          'flex min-w-0 flex-1 items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                          isSelected
                            ? 'text-accent-foreground'
                            : 'text-foreground hover:bg-accent/50',
                        )}
                      >
                        <span className="truncate font-medium">{level.name}</span>
                        {isSelected ? (
                          <ChevronRight className="size-4 shrink-0" />
                        ) : null}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={t('documentAssignment.levels.remove')}
                        onClick={() => setLevelToDelete(level)}
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
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium text-foreground">
                {t('documentAssignment.columns.fields')}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {!selectedTemplateId ? (
                <p className="text-sm text-muted-foreground">
                  {t('documentAssignment.empty.selectTemplate')}
                </p>
              ) : !selectedLevelId ? (
                <p className="text-sm text-muted-foreground">
                  {t('documentAssignment.empty.selectLevel')}
                </p>
              ) : selectedTemplate ? (
                <MetadataFieldCheckboxTree
                  schema={selectedTemplate.groups}
                  allowedFields={allowedFields}
                  onToggleGroup={(group, checked) => {
                    if (!selectedTemplateId || !selectedLevelId) return
                    dataConfigStore.toggleGroupForLevel(
                      selectedTemplateId,
                      selectedLevelId,
                      group.groupCode,
                      checked,
                    )
                  }}
                  onToggleField={(fieldKey, checked) => {
                    if (!selectedTemplateId || !selectedLevelId) return
                    dataConfigStore.toggleFieldForLevel(
                      selectedTemplateId,
                      selectedLevelId,
                      fieldKey,
                      checked,
                    )
                  }}
                />
              ) : null}
            </div>
          </section>
        </div>
      )}

      <Dialog open={addLevelOpen} onOpenChange={setAddLevelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('documentAssignment.levels.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="level-name">
              {t('documentAssignment.levels.nameLabel')}
            </Label>
            <Input
              id="level-name"
              value={levelName}
              onChange={(e) => setLevelName(e.target.value)}
              placeholder={t('documentAssignment.levels.namePlaceholder')}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddLevelOpen(false)}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleAddLevel}
              disabled={!levelName.trim()}
            >
              {t('documentAssignment.levels.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(levelToDelete)}
        onOpenChange={(open) => {
          if (!open) setLevelToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.levelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.levelDescription', {
                name: levelToDelete?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete.cancelButton')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLevel}>
              {t('delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
