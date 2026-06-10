import { useState } from 'react'
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
import { ReadOnlyDossierTree } from '@/features/data-config/components/ReadOnlyDossierTree'
import { dataConfigStore, useDataConfigStore } from '@/features/data-config/store'
import type { DataTreeNodeT } from '@/features/data-management/types'

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
  const mockDossierTree = useDataConfigStore((s) => s.mockDossierTree)
  const [selectedNode, setSelectedNode] = useState<DataTreeNodeT | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedNode(null)
    }
    onOpenChange(nextOpen)
  }

  const handleSave = () => {
    if (!selectedNode) {
      toast.error(t('errors.noDossierSelected'))
      return
    }

    const dossierId = selectedNode.dossierId ?? selectedNode.id
    const newTemplate = dataConfigStore.addTemplateFromDossier(
      dossierId,
      selectedNode.name,
    )

    toast.success(t('documentTypes.picker.success'))
    handleOpenChange(false)
    onSaved(newTemplate.id)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('documentTypes.picker.title')}</DialogTitle>
          <DialogDescription>
            {t('documentTypes.picker.description')}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t('documentTypes.picker.selectHint')}
        </p>

        <div className="flex min-h-0 flex-1 flex-col" style={{ minHeight: 320 }}>
          <ReadOnlyDossierTree
            tree={mockDossierTree}
            selectedId={selectedNode?.id}
            onSelect={setSelectedNode}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {t('documentTypes.picker.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!selectedNode}>
            {t('documentTypes.picker.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
