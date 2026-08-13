import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
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

interface ArchiveSubmitSecuritySectionProps {
  dossierSecurityLevelId: string | null
  onDossierSecurityLevelChange: (value: string | null) => void
  files: Array<PrepareArchiveSubmitFileT>
  fileSecurityById: Record<string, string | null>
  onFileSecurityChange: (fileId: string, value: string | null) => void
  onApplyDossierLevelToAll: () => void
  disabled?: boolean
}

export function ArchiveSubmitSecuritySection({
  dossierSecurityLevelId,
  onDossierSecurityLevelChange,
  files,
  fileSecurityById,
  onFileSecurityChange,
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
        required
      />
      <p className="text-sm text-muted-foreground">{t('security.levelPasswordHint')}</p>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {t('security.filesTitle')}
            <span className="text-destructive"> *</span>
          </p>
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
                  <TableHead className="w-[220px]">
                    {t('security.fileLevelColumn')}
                    <span className="text-destructive"> *</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
