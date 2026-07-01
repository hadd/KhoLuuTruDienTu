import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import { DataManagementFolderPicker } from '@/features/scan-intake/components/DataManagementFolderPicker'
import type { useScanIntakeMutations } from '@/features/scan-intake/queries'
import { translateError } from '@/lib/utils/translate-error'

interface PromoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdfKeys: Array<string>
  pdfLabels: Array<string>
  organizeFolderPath?: string
  organizeFolderLabel?: string
  mutations: ReturnType<typeof useScanIntakeMutations>
  onCommitted: () => void
}

export function PromoteModal({
  open,
  onOpenChange,
  pdfKeys,
  pdfLabels,
  organizeFolderPath,
  organizeFolderLabel,
  mutations,
  onCommitted,
}: PromoteModalProps) {
  const { t } = useTranslation('scan-intake')
  const { t: tCommon } = useTranslation('common')
  const [projectCode, setProjectCode] = useState<string | undefined>()
  const [targetFolderPath, setTargetFolderPath] = useState<string | undefined>()
  const [errors, setErrors] = useState<
    Array<{ folderPath: string; pdfName: string; error: string }>
  >([])

  const isPromoting = mutations.promoteMutation.isPending

  useEffect(() => {
    if (open) {
      setTargetFolderPath(undefined)
      setErrors([])
    }
  }, [open, projectCode])

  async function handlePromote() {
    if (!projectCode?.trim()) {
      toast.error(t('promote.projectRequired'))
      return
    }
    if (!targetFolderPath?.trim()) {
      toast.error(t('promote.targetFolderRequired'))
      return
    }
    if (pdfKeys.length === 0) {
      toast.error(t('promote.nothingSelected'))
      return
    }

    setErrors([])
    try {
      const result = await mutations.promoteMutation.mutateAsync({
        projectCode: projectCode.trim(),
        targetFolderPath: targetFolderPath.trim(),
        organizeFolderPath: organizeFolderPath?.trim() || undefined,
        pdfKeys,
      })
      if (result.errors.length > 0) {
        setErrors(result.errors)
        const firstMessage = translateError(new Error(result.errors[0]?.error ?? ''))
        toast.error(firstMessage || t('commit.partialError', { count: result.errors.length }))
        return
      }
      if (result.promoted === 0) {
        toast.error(t('promote.nothingPromoted'))
        return
      }
      toast.success(t('commit.success', { count: result.promoted }))
      onCommitted()
      onOpenChange(false)
    } catch (err) {
      toast.error(translateError(err))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPromoting) onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('commit.title')}</DialogTitle>
          <DialogDescription>
            {organizeFolderPath
              ? t('commit.descriptionFolder', {
                  folder: organizeFolderLabel ?? organizeFolderPath,
                  count: pdfKeys.length,
                })
              : t('commit.descriptionSelected', { count: pdfKeys.length })}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-24 space-y-1 overflow-y-auto text-sm text-muted-foreground">
          {pdfLabels.map((label, i) => (
            <li key={`${pdfKeys[i]}-${i}`}>· {label}</li>
          ))}
        </ul>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('promote.projectLabel')}</p>
            <ProjectSelect
              value={projectCode}
              onValueChange={setProjectCode}
              className="w-full"
            />
          </div>

          {projectCode ? (
            <DataManagementFolderPicker
              projectCode={projectCode}
              value={targetFolderPath}
              onValueChange={setTargetFolderPath}
            />
          ) : null}
        </div>

        {isPromoting ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('commit.promoting')}
          </div>
        ) : errors.length > 0 ? (
          <ul className="max-h-48 space-y-2 overflow-y-auto text-sm text-destructive">
            {errors.map((item) => (
              <li key={`${item.folderPath}-${item.pdfName}`}>
                {item.pdfName}: {translateError(new Error(item.error))}
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isPromoting}
            onClick={() => onOpenChange(false)}
          >
            {tCommon('common.cancel')}
          </Button>
          <Button
            disabled={
              isPromoting ||
              pdfKeys.length === 0 ||
              !projectCode ||
              !targetFolderPath
            }
            onClick={() => void handlePromote()}
          >
            {isPromoting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t('commit.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
