import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import { useEffectivePermissions } from '@/features/auth/hooks/useEffectivePermissions'
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import { ALL_PROJECTS_CODE } from '@/features/data-management/lib/constants'
import { dataManagementProjectsQueryOptions } from '@/features/data-management/queries'
import { DataManagementFolderPicker } from '@/features/scan-intake/components/DataManagementFolderPicker'
import { hasFullAccess, isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import type { useScanIntakeMutations } from '@/features/scan-intake/queries'
import { translateError } from '@/lib/utils/translate-error'

interface PromoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdfKeys: Array<string>
  pdfLabels: Array<string>
  folderPaths?: Array<string>
  organizeFolderPath?: string
  organizeFolderLabel?: string
  selectedFolderCount?: number
  mutations: ReturnType<typeof useScanIntakeMutations>
  onCommitted: () => void
}

export function PromoteModal({
  open,
  onOpenChange,
  pdfKeys,
  pdfLabels,
  folderPaths = [],
  organizeFolderPath,
  organizeFolderLabel,
  selectedFolderCount = 0,
  mutations,
  onCommitted,
}: PromoteModalProps) {
  const { t } = useTranslation('scan-intake')
  const { t: tCommon } = useTranslation('common')
  
  // projectCode có thể là null (không chọn) hoặc string (có chọn)
  const [projectCode, setProjectCode] = useState<string | null>(null)
  const [targetFolderPath, setTargetFolderPath] = useState<string | undefined>('raw')
  const [errors, setErrors] = useState<
    Array<{ folderPath: string; pdfName: string; error: string }>
  >([])
  const [isHandling, setIsHandling] = useState(false)

  // Kiểm tra quyền chọn dự án
  const permissions = useEffectivePermissions()
  const canSelectProject = useMemo(() => {
    return (
      hasFullAccess(permissions) ||
      isPermissionGranted(permissions, 'projects.read', 'projects') ||
      isPermissionGranted(permissions, 'projects.*', 'projects')
    )
  }, [permissions])

  // Lấy danh sách dự án
  const { data: projectsData, isPending: isProjectsLoading } = useQuery({
    ...dataManagementProjectsQueryOptions(),
    enabled: open && canSelectProject,
  })

  const realProjects = useMemo(() => {
    const items = projectsData?.items ?? []
    return items.filter(
      (p) => p.projectCode && p.projectCode.trim() !== ALL_PROJECTS_CODE,
    )
  }, [projectsData])

  useEffect(() => {
    if (open) {
      setProjectCode(null) // Mặc định là null nếu không chọn
      setTargetFolderPath('raw')
      setErrors([])
    }
  }, [open])

  const isPromoting = mutations.promoteMutation.isPending

  async function handlePromote() {
    if (!targetFolderPath?.trim()) {
      toast.error(t('promote.targetFolderRequired', { defaultValue: 'Vui lòng chọn thư mục đích' }))
      return
    }
    if (pdfKeys.length === 0 && folderPaths.length === 0) {
      toast.error(t('promote.nothingSelected'))
      return
    }

    if (isHandling) return
    setIsHandling(true)

    setErrors([])
    try {
      // ✅ Gửi projectCode (chuỗi mã dự án HOẶC null)
      const result = await mutations.promoteMutation.mutateAsync({
        projectCode: projectCode || null,
        targetFolderPath: targetFolderPath.trim(),
        organizeFolderPath: organizeFolderPath?.trim() || undefined,
        pdfKeys,
        folderPaths,
      })

      if (result.errors.length > 0) {
        setErrors(result.errors)
        const firstMessage = translateError(new Error(result.errors[0]?.error ?? ''))
        toast.error(firstMessage || t('commit.partialError', { count: result.errors.length }))
        return
      }
      if (result.promoted === 0 && folderPaths.length === 0) {
        toast.error(t('promote.nothingPromoted'))
        return
      }
      toast.success(t('commit.success', { count: result.promoted || folderPaths.length }))
      onCommitted()
      onOpenChange(false)
    } catch (err) {
      toast.error(translateError(err))
    } finally {
      setIsHandling(false)
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
              : selectedFolderCount > 1
                ? t('commit.descriptionFolders', {
                    count: pdfKeys.length,
                    folderCount: selectedFolderCount,
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
          {/* Dropdown chọn dự án (Tùy chọn: người dùng có thể chọn hoặc để trống) */}
          {canSelectProject && realProjects.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('promote.projectLabel')} (Tùy chọn)</p>
                {projectCode ? (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      setProjectCode(null)
                      setTargetFolderPath('raw')
                    }}
                  >
                    Bỏ chọn dự án (Lưu vào Data Lake chung)
                  </button>
                ) : null}
              </div>
              <ProjectSelect
                value={projectCode ?? undefined}
                showAllOption={false}
                onValueChange={(code) => {
                  setProjectCode(code || null)
                  setTargetFolderPath('raw')
                }}
                className="w-full"
              />
            </div>
          ) : null}

          {/* Cây thư mục đích: Nếu có projectCode thì load theo project, nếu null thì load raw */}
          <DataManagementFolderPicker
            projectCode={projectCode || ALL_PROJECTS_CODE}
            value={targetFolderPath}
            onValueChange={setTargetFolderPath}
          />
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
            disabled={isHandling || isPromoting}
            onClick={() => onOpenChange(false)}
          >
            {tCommon('common.cancel')}
          </Button>
          <Button
            disabled={
              isHandling ||
              isPromoting ||
              (pdfKeys.length === 0 && folderPaths.length === 0) ||
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