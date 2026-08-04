import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PrepareArchiveSubmitFileT } from '@/features/archive-submission/types'
import { SecurityLevelPicker } from '@/features/security-level'
import { PasswordInputWithToggle } from '@/features/security-level/components/SecurityAccessPasswordDialog'

export type PasswordModeT = 'inherit' | 'custom' | 'clear'

export type FilePasswordDraftT = {
  mode: PasswordModeT
  password: string
  confirm: string
}

interface ArchiveSubmitSecuritySectionProps {
  dossierSecurityLevelId: string | null
  onDossierSecurityLevelChange: (value: string | null) => void
  dossierPasswordMode: PasswordModeT
  onDossierPasswordModeChange: (mode: PasswordModeT) => void
  dossierPassword: string
  onDossierPasswordChange: (value: string) => void
  dossierPasswordConfirm: string
  onDossierPasswordConfirmChange: (value: string) => void
  dossierHasOwnPassword?: boolean
  files: Array<PrepareArchiveSubmitFileT>
  fileSecurityById: Record<string, string | null>
  onFileSecurityChange: (fileId: string, value: string | null) => void
  filePasswordById: Record<string, FilePasswordDraftT>
  onFilePasswordChange: (fileId: string, patch: Partial<FilePasswordDraftT>) => void
  onApplyDossierLevelToAll: () => void
  disabled?: boolean
}

export function ArchiveSubmitSecuritySection({
  dossierSecurityLevelId,
  onDossierSecurityLevelChange,
  dossierPasswordMode,
  onDossierPasswordModeChange,
  dossierPassword,
  onDossierPasswordChange,
  dossierPasswordConfirm,
  onDossierPasswordConfirmChange,
  dossierHasOwnPassword = false,
  files,
  fileSecurityById,
  onFileSecurityChange,
  filePasswordById,
  onFilePasswordChange,
  onApplyDossierLevelToAll,
  disabled = false,
}: ArchiveSubmitSecuritySectionProps) {
  const { t } = useTranslation('archive-submission')

  return (
    <div className="space-y-4 border-t pt-4">
      <SecurityLevelPicker
        label={t('security.dossierLevel')}
        value={dossierSecurityLevelId}
        onChange={onDossierSecurityLevelChange}
        allowClear={false}
        disabled={disabled}
      />

      <div className="space-y-2 rounded-md border p-3">
        <Label>{t('security.dossierPassword')}</Label>
        <Select
          value={dossierPasswordMode}
          onValueChange={(value) => onDossierPasswordModeChange(value as PasswordModeT)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">{t('security.passwordModeInherit')}</SelectItem>
            <SelectItem value="custom">{t('security.passwordModeCustom')}</SelectItem>
            {dossierHasOwnPassword ? (
              <SelectItem value="clear">{t('security.passwordModeClear')}</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
        {dossierPasswordMode === 'custom' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="archive-submit-dossier-password">{t('security.password')}</Label>
              <PasswordInputWithToggle
                id="archive-submit-dossier-password"
                value={dossierPassword}
                onChange={onDossierPasswordChange}
                disabled={disabled}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="archive-submit-dossier-password-confirm">
                {t('security.passwordConfirm')}
              </Label>
              <PasswordInputWithToggle
                id="archive-submit-dossier-password-confirm"
                value={dossierPasswordConfirm}
                onChange={onDossierPasswordConfirmChange}
                disabled={disabled}
                autoComplete="new-password"
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{t('security.filesTitle')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !dossierSecurityLevelId || files.length === 0}
            onClick={onApplyDossierLevelToAll}
          >
            {t('security.applyDossierToAll')}
          </Button>
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('security.noPdfFiles')}</p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('security.fileNameColumn')}</TableHead>
                  <TableHead className="w-[220px]">{t('security.fileLevelColumn')}</TableHead>
                  <TableHead className="w-[280px]">{t('security.filePasswordColumn')}</TableHead>                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => {
                  const draft = filePasswordById[file.id] ?? {
                    mode: 'inherit' as const,
                    password: '',
                    confirm: '',
                  }
                  return (
                    <TableRow key={file.id}>
                      <TableCell className="align-top font-medium">{file.fileName}</TableCell>
                      <TableCell className="align-top">
                        <SecurityLevelPicker
                          hideLabel
                          value={fileSecurityById[file.id] ?? null}
                          onChange={(next) => onFileSecurityChange(file.id, next)}
                          allowClear={false}
                          disabled={disabled}
                        />
                      </TableCell>
                      <TableCell className="align-top space-y-2">
                        <Select
                          value={draft.mode}
                          onValueChange={(value) =>
                            onFilePasswordChange(file.id, {
                              mode: value as PasswordModeT,
                            })
                          }
                          disabled={disabled}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inherit">
                              {t('security.passwordModeInherit')}
                            </SelectItem>
                            <SelectItem value="custom">
                              {t('security.passwordModeCustom')}
                            </SelectItem>
                            {file.passwordSource === 'own' ? (
                              <SelectItem value="clear">
                                {t('security.passwordModeClear')}
                              </SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                        {draft.mode === 'custom' ? (
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <Label htmlFor={`archive-submit-file-password-${file.id}`}>
                                {t('security.password')}
                              </Label>
                              <PasswordInputWithToggle
                                id={`archive-submit-file-password-${file.id}`}
                                value={draft.password}
                                onChange={(value) =>
                                  onFilePasswordChange(file.id, { password: value })
                                }
                                disabled={disabled}
                                autoComplete="new-password"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor={`archive-submit-file-password-confirm-${file.id}`}
                              >
                                {t('security.passwordConfirm')}
                              </Label>
                              <PasswordInputWithToggle
                                id={`archive-submit-file-password-confirm-${file.id}`}
                                value={draft.confirm}
                                onChange={(value) =>
                                  onFilePasswordChange(file.id, { confirm: value })
                                }
                                disabled={disabled}
                                autoComplete="new-password"
                              />
                            </div>
                          </div>
                        ) : null}
                      </TableCell>                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
