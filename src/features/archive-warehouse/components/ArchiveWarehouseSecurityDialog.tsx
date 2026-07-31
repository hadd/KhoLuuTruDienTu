import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  updateArchiveWarehouseDossierSecurity,
  updateArchiveWarehouseFilesSecurity,
} from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { SecurityLevelPicker } from '@/features/security-level'
import { PasswordInputWithToggle } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import {
  clearDossierAccessSession,
  clearFileAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'
import { translateError } from '@/lib/utils/translate-error'

type PasswordModeT = 'keep' | 'custom' | 'clear'

export type ArchiveWarehouseSecurityTargetFileT = {
  id: string
  fileName: string
  securityLevelId: string | null
  passwordSource: 'own' | 'security_level' | 'none'
}

type ArchiveWarehouseSecurityDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  fileId?: string | null
  fileName?: string | null
  currentSecurityLevelId?: string | null
  passwordSource?: 'own' | 'security_level' | 'none'
  targetFiles?: Array<ArchiveWarehouseSecurityTargetFileT>
  onSuccess?: () => void
}

function resolveInitialSecurityLevelId(
  targets: Array<ArchiveWarehouseSecurityTargetFileT>,
  fallback: string | null,
): string | null {
  if (targets.length === 0) return fallback
  const first = targets[0].securityLevelId
  const allSame = targets.every((file) => file.securityLevelId === first)
  return allSame ? first : first
}

export function ArchiveWarehouseSecurityDialog({
  open,
  onOpenChange,
  dossierId,
  fileId,
  fileName,
  currentSecurityLevelId = null,
  passwordSource = 'none',
  targetFiles,
  onSuccess,
}: ArchiveWarehouseSecurityDialogProps) {
  const { t } = useTranslation('archive-warehouse')
  const queryClient = useQueryClient()

  const fileTargets = useMemo(() => {
    if (targetFiles?.length) return targetFiles
    if (fileId) {
      return [
        {
          id: fileId,
          fileName: fileName ?? '',
          securityLevelId: currentSecurityLevelId,
          passwordSource,
        },
      ]
    }
    return []
  }, [
    currentSecurityLevelId,
    fileId,
    fileName,
    passwordSource,
    targetFiles,
  ])

  const isFileMode = fileTargets.length > 0
  const effectivePasswordSource = isFileMode
    ? fileTargets.some((file) => file.passwordSource === 'own')
      ? 'own'
      : fileTargets.some((file) => file.passwordSource === 'security_level')
        ? 'security_level'
        : 'none'
    : passwordSource
  const canClearOwnPassword =
    isFileMode &&
    fileTargets.every((file) => file.passwordSource === 'own')

  const [securityLevelId, setSecurityLevelId] = useState<string | null>(
    resolveInitialSecurityLevelId(fileTargets, currentSecurityLevelId),
  )
  const [passwordMode, setPasswordMode] = useState<PasswordModeT>('keep')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')

  useEffect(() => {
    if (!open) return
    setSecurityLevelId(
      resolveInitialSecurityLevelId(fileTargets, currentSecurityLevelId),
    )
    setPasswordMode('keep')
    setPassword('')
    setConfirm('')
    setCurrentPassword('')
  }, [open, currentSecurityLevelId, fileTargets])

  const mutation = useMutation({
    mutationFn: async () => {
      if (isFileMode && fileTargets.length === 0) {
        throw new Error(t('security.selectFilesRequired'))
      }

      const payload = {
        securityLevelId,
        ...(passwordMode === 'custom' ? { accessPassword: password.trim() } : {}),
        ...(passwordMode === 'clear' ? { clearAccessPassword: true } : {}),
        ...(passwordMode !== 'keep' && effectivePasswordSource === 'own'
          ? { currentAccessPassword: currentPassword.trim() || undefined }
          : {}),
      }

      if (isFileMode) {
        return updateArchiveWarehouseFilesSecurity(
          dossierId,
          fileTargets.map((file) => file.id),
          payload,
        )
      }
      return updateArchiveWarehouseDossierSecurity(dossierId, payload)
    },
    onSuccess: (data) => {
      const detailKey = ['archive-warehouse', 'dossier-detail', dossierId] as const

      if ('files' in data) {
        for (const file of data.files) {
          clearFileAccessToken(file.id)
        }

        queryClient.setQueryData(detailKey, (old: unknown) => {
          if (!old || typeof old !== 'object') return old
          const current = old as {
            files?: Array<Record<string, unknown> & { id: string }>
          }
          const byId = new Map(data.files.map((file) => [file.id, file]))
          return {
            ...current,
            files: (current.files ?? []).map((file) => {
              const fileResult = byId.get(file.id)
              if (!fileResult) return file
              const needsGate = fileResult.passwordSource !== 'none'
              return {
                ...file,
                securityLevelId: fileResult.securityLevelId,
                passwordSource: fileResult.passwordSource,
                accessLocked: needsGate ? true : file.accessLocked,
                requiredFilePassword: needsGate,
                fileUrl: needsGate ? '' : file.fileUrl,
                searchablePdfUrl: needsGate ? null : file.searchablePdfUrl,
              }
            }),
          }
        })

        const anyNeedsRefetch = data.files.some(
          (file) => file.passwordSource === 'none',
        )
        if (anyNeedsRefetch) {
          void queryClient.invalidateQueries({ queryKey: detailKey })
        }
      } else if ('dossier' in data) {
        clearDossierAccessSession(dossierId)
        const dossierResult = data.dossier
        const needsGate = dossierResult.passwordSource !== 'none'
        queryClient.setQueryData(detailKey, (old: unknown) => {
          if (!old || typeof old !== 'object') return old
          const current = old as {
            dossier?: Record<string, unknown>
            files?: Array<Record<string, unknown>>
          }
          const next = {
            ...current,
            dossier: {
              ...current.dossier,
              securityLevelId: dossierResult.securityLevelId,
              accessPasswordEnabled: dossierResult.accessPasswordEnabled,
              passwordSource: dossierResult.passwordSource,
            },
            files: needsGate
              ? (current.files ?? []).map((file) => ({
                  ...file,
                  accessLocked: true,
                  fileUrl: '',
                  searchablePdfUrl: null,
                }))
              : current.files,
          }
          if (!needsGate) {
            void queryClient.invalidateQueries({ queryKey: detailKey })
          }
          return next
        })
      }

      toast.success(t('security.saveSuccess'))
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })

  function handleSubmit() {
    if (isFileMode && fileTargets.length === 0) {
      toast.error(t('security.selectFilesRequired'))
      return
    }
    if (passwordMode === 'custom') {
      const trimmed = password.trim()
      if (!trimmed) {
        toast.error(t('security.passwordRequired'))
        return
      }
      if (trimmed !== confirm.trim()) {
        toast.error(t('security.passwordMismatch'))
        return
      }
    }
    if (
      passwordMode !== 'keep' &&
      effectivePasswordSource === 'own' &&
      !currentPassword.trim()
    ) {
      toast.error(t('security.currentPasswordRequired'))
      return
    }
    mutation.mutate()
  }

  const fileDescription =
    fileTargets.length === 1
      ? t('security.fileDescription', { name: fileTargets[0].fileName })
      : t('security.filesDescription', { count: fileTargets.length })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isFileMode ? t('security.fileTitle') : t('security.dossierTitle')}
          </DialogTitle>
          <DialogDescription>
            {isFileMode ? fileDescription : t('security.dossierDescription')}
          </DialogDescription>
        </DialogHeader>

        {isFileMode && fileTargets.length > 1 ? (
          <ul className="max-h-28 list-disc overflow-y-auto pl-5 text-xs text-muted-foreground">
            {fileTargets.map((file) => (
              <li key={file.id}>{file.fileName}</li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-4">
          <SecurityLevelPicker
            label={t('detail.securityLevel')}
            value={securityLevelId}
            onChange={setSecurityLevelId}
            allowClear={false}
            disabled={mutation.isPending}
          />

          <div className="space-y-2">
            <Label>{t('security.passwordMode')}</Label>
            <Select
              value={passwordMode}
              onValueChange={(value) => setPasswordMode(value as PasswordModeT)}
              disabled={mutation.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">{t('security.passwordModeKeep')}</SelectItem>
                <SelectItem value="custom">
                  {t('security.passwordModeCustom')}
                </SelectItem>
                {canClearOwnPassword ? (
                  <SelectItem value="clear">
                    {t('security.passwordModeClear')}
                  </SelectItem>
                ) : !isFileMode && passwordSource === 'own' ? (
                  <SelectItem value="clear">
                    {t('security.passwordModeClear')}
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          {passwordMode !== 'keep' && effectivePasswordSource === 'own' ? (
            <div className="space-y-1">
              <Label htmlFor="warehouse-security-current-password">
                {t('security.currentPassword')}
              </Label>
              <PasswordInputWithToggle
                id="warehouse-security-current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
                disabled={mutation.isPending}
                autoComplete="current-password"
              />
            </div>
          ) : null}

          {passwordMode === 'custom' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="warehouse-security-password">
                  {t('security.password')}
                </Label>
                <PasswordInputWithToggle
                  id="warehouse-security-password"
                  value={password}
                  onChange={setPassword}
                  disabled={mutation.isPending}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="warehouse-security-password-confirm">
                  {t('security.passwordConfirm')}
                </Label>
                <PasswordInputWithToggle
                  id="warehouse-security-password-confirm"
                  value={confirm}
                  onChange={setConfirm}
                  disabled={mutation.isPending}
                  autoComplete="new-password"
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t('actions.cancel', { defaultValue: 'Hủy' })}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {t('security.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
