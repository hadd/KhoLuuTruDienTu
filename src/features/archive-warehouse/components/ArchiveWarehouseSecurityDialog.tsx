import { useMutation, useQueryClient } from '@tanstack/react-query'
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
  updateArchiveWarehouseFileSecurity,
} from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { SecurityLevelPicker } from '@/features/security-level'
import { PasswordInputWithToggle } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import {
  clearDossierAccessSession,
  clearFileAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'
import { translateError } from '@/lib/utils/translate-error'

type PasswordModeT = 'keep' | 'custom' | 'clear'

type ArchiveWarehouseSecurityDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  fileId?: string | null
  fileName?: string | null
  currentSecurityLevelId?: string | null
  passwordSource?: 'own' | 'security_level' | 'none'
}

export function ArchiveWarehouseSecurityDialog({
  open,
  onOpenChange,
  dossierId,
  fileId,
  fileName,
  currentSecurityLevelId = null,
  passwordSource = 'none',
}: ArchiveWarehouseSecurityDialogProps) {
  const { t } = useTranslation('archive-warehouse')
  const queryClient = useQueryClient()
  const isFile = Boolean(fileId)

  const [securityLevelId, setSecurityLevelId] = useState<string | null>(
    currentSecurityLevelId,
  )
  const [passwordMode, setPasswordMode] = useState<PasswordModeT>('keep')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')

  useEffect(() => {
    if (!open) return
    setSecurityLevelId(currentSecurityLevelId)
    setPasswordMode('keep')
    setPassword('')
    setConfirm('')
    setCurrentPassword('')
  }, [open, currentSecurityLevelId])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        securityLevelId,
        ...(passwordMode === 'custom' ? { accessPassword: password.trim() } : {}),
        ...(passwordMode === 'clear' ? { clearAccessPassword: true } : {}),
        ...(passwordMode !== 'keep' && passwordSource === 'own'
          ? { currentAccessPassword: currentPassword.trim() || undefined }
          : {}),
      }

      if (isFile && fileId) {
        return updateArchiveWarehouseFileSecurity(dossierId, fileId, payload)
      }
      return updateArchiveWarehouseDossierSecurity(dossierId, payload)
    },
    onSuccess: (data) => {
      if (isFile && fileId) {
        clearFileAccessToken(fileId)
      } else {
        clearDossierAccessSession(dossierId)
      }

      const detailKey = ['archive-warehouse', 'dossier-detail', dossierId] as const
      queryClient.setQueryData(detailKey, (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        const current = old as {
          dossier?: Record<string, unknown>
          files?: Array<Record<string, unknown> & { id: string }>
        }

        if (isFile && fileId && 'file' in data) {
          const fileResult = data.file
          const needsGate = fileResult.passwordSource !== 'none'
          return {
            ...current,
            files: (current.files ?? []).map((file) =>
              file.id === fileId
                ? {
                    ...file,
                    securityLevelId: fileResult.securityLevelId,
                    passwordSource: fileResult.passwordSource,
                    accessLocked: needsGate ? true : file.accessLocked,
                    requiredFilePassword: needsGate,
                    fileUrl: needsGate ? '' : file.fileUrl,
                    searchablePdfUrl: needsGate ? null : file.searchablePdfUrl,
                  }
                : file,
            ),
          }
        }

        if ('dossier' in data) {
          const dossierResult = data.dossier
          const needsGate = dossierResult.passwordSource !== 'none'
          const next = {
            ...current,
            dossier: {
              ...current.dossier,
              securityLevelId: dossierResult.securityLevelId,
              accessPasswordEnabled: dossierResult.accessPasswordEnabled,
              passwordSource: dossierResult.passwordSource,
            },
            // Khi đổi mật khẩu hồ sơ: giữ cache, đánh dấu file cần unlock lại thay vì refetch 403.
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
        }

        return old
      })

      // File không còn gate → refetch URL; còn gate thì giữ cache đã cập nhật (tránh GET 403).
      if (isFile && fileId && 'file' in data && data.file.passwordSource === 'none') {
        void queryClient.invalidateQueries({ queryKey: detailKey })
      }

      toast.success(t('security.saveSuccess'))
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })

  function handleSubmit() {
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
      passwordSource === 'own' &&
      !currentPassword.trim()
    ) {
      toast.error(t('security.currentPasswordRequired'))
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isFile ? t('security.fileTitle') : t('security.dossierTitle')}
          </DialogTitle>
          <DialogDescription>
            {isFile
              ? t('security.fileDescription', { name: fileName ?? '' })
              : t('security.dossierDescription')}
          </DialogDescription>
        </DialogHeader>

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
                {passwordSource === 'own' ? (
                  <SelectItem value="clear">
                    {t('security.passwordModeClear')}
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          {passwordMode !== 'keep' && passwordSource === 'own' ? (
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
