import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

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
import { useDeleteProject, useCheckProjectDependencies } from '@/features/project-manager/queries'
import type { ProjectT } from '@/features/project-manager/types'

interface ProjectDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectT | null
}

export function ProjectDeleteDialog({
  open,
  onOpenChange,
  project,
}: ProjectDeleteDialogProps) {
  const { t } = useTranslation('project-manager')
  const deleteProject = useDeleteProject()
  const checkDeps = useCheckProjectDependencies()
  const [deps, setDeps] = useState<{ dossierCount: number, folderCount: number, groupCount: number, total: number } | null>(null)

  useEffect(() => {
    if (open && project) {
      setDeps(null)
      checkDeps.mutate(project.projectCode, {
        onSuccess: (data) => setDeps(data),
      })
    }
  }, [open, project])

  if (!project) return null

  const handleDelete = () => {
    deleteProject.mutate(project.projectCode, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  const isPending = deleteProject.isPending || checkDeps.isPending

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.confirmTitle', 'Xác nhận xóa dự án')}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{t('delete.confirmDescription', { name: project.projectName, defaultValue: `Bạn có chắc chắn muốn xóa dự án ${project.projectName}?` })}</p>
              
              {checkDeps.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang kiểm tra dữ liệu liên quan...
                </div>
              )}

              {deps && deps.total > 0 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-sm rounded-md border border-amber-200 dark:border-amber-900">
                  <p className="font-semibold mb-1">Cảnh báo: Dự án đang có dữ liệu liên quan!</p>
                  <ul className="list-disc list-inside ml-1">
                    {deps.dossierCount > 0 && <li>{deps.dossierCount} hồ sơ</li>}
                    {deps.folderCount > 0 && <li>{deps.folderCount} thư mục</li>}
                    {deps.groupCount > 0 && <li>{deps.groupCount} nhóm người dùng</li>}
                  </ul>
                  <p className="mt-2">Hành động xóa cứng sẽ tự động gỡ dự án khỏi các dữ liệu này trước khi xóa. Bạn có chắc chắn muốn tiếp tục không?</p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t('delete.cancelButton', 'Hủy')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteProject.isPending
              ? t('delete.deleting', 'Đang xóa...')
              : t('delete.confirmButton', 'Xóa')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
