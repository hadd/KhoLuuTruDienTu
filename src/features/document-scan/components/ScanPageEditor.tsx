import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { transformScanPageImage } from '@/features/document-scan/lib/imageTransform'
import {
  useDeleteScanPageMutation,
  useUpdateScanPageMutation,
} from '@/features/document-scan/queries'
import type { ScanPageRotationT, ScanPageT } from '@/features/document-scan/types'
import { cn } from '@/lib/utils/cn'

const ROTATION_OPTIONS: Array<ScanPageRotationT> = [0, 90, 180, 270]

interface ScanPageEditorProps {
  page: ScanPageT | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function ScanPageEditor({
  page,
  open,
  onOpenChange,
  onDeleted,
}: ScanPageEditorProps) {
  const { t } = useTranslation('document-scan')
  const updatePage = useUpdateScanPageMutation()
  const deletePage = useDeleteScanPageMutation()
  const [name, setName] = useState('')
  const [rotation, setRotation] = useState<ScanPageRotationT>(0)
  const [scale, setScale] = useState(1)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!page) return
    setName(page.name)
    setRotation(page.rotation)
    setScale(page.scale)
  }, [page])

  useEffect(() => {
    if (!page || !open) return

    let cancelled = false
    let objectUrl: string | null = null

    void transformScanPageImage(page.imageData, rotation, scale).then((result) => {
      if (cancelled) return
      objectUrl = result.dataUrl
      setPreviewUrl(result.dataUrl)
    })

    return () => {
      cancelled = true
      if (objectUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [page, open, rotation, scale])

  const scalePercent = useMemo(() => Math.round(scale * 100), [scale])

  const persistPatch = async (patch: {
    name?: string
    rotation?: ScanPageRotationT
    scale?: number
  }) => {
    if (!page) return
    await updatePage.mutateAsync({ pageId: page.id, patch })
  }

  const handleDelete = async () => {
    if (!page) return
    await deletePage.mutateAsync(page.id)
    setDeleteOpen(false)
    onOpenChange(false)
    onDeleted?.()
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{t('page.editorTitle')}</SheetTitle>
          </SheetHeader>

          {page ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
              <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={page.name}
                    className="max-h-[360px] max-w-full object-contain"
                  />
                ) : (
                  <img
                    src={page.imageData}
                    alt={page.name}
                    className="max-h-[360px] max-w-full object-contain"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="scan-page-name">{t('form.fields.name.label')}</Label>
                <Input
                  id="scan-page-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => {
                    if (name.trim() && name !== page.name) {
                      void persistPatch({ name: name.trim() })
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('page.rotation')}</Label>
                <div className="flex flex-wrap gap-2">
                  {ROTATION_OPTIONS.map((value) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={rotation === value ? 'default' : 'outline'}
                      onClick={() => {
                        setRotation(value)
                        void persistPatch({ rotation: value })
                      }}
                    >
                      {value}°
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('page.scale')}</Label>
                  <span className="text-sm text-muted-foreground">
                    {scalePercent}%
                  </span>
                </div>
                <Slider
                  min={50}
                  max={200}
                  step={5}
                  value={[scalePercent]}
                  onValueChange={(values) => {
                    const nextScale = (values[0] ?? 100) / 100
                    setScale(nextScale)
                  }}
                  onValueCommit={(values) => {
                    const nextScale = (values[0] ?? 100) / 100
                    void persistPatch({ scale: nextScale })
                  }}
                />
              </div>

              <Button
                type="button"
                variant="destructive"
                className={cn('mt-auto')}
                onClick={() => setDeleteOpen(true)}
              >
                {t('actions.delete')}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('page.delete.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('page.delete.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePage.isPending}>
              {t('page.delete.cancelButton')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePage.isPending}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {t('page.delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
