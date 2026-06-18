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
import { useDeleteProject } from '@/features/project-manager/queries'
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

  if (!project) return null

  const handleDelete = () => {
    deleteProject.mutate(project.projectCode, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('delete.confirmDescription', { name: project.projectName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteProject.isPending}>
            {t('delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={deleteProject.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteProject.isPending
              ? t('delete.deleting')
              : t('delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
