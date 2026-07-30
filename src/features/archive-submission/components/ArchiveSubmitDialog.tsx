import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { ArchiveDynamicForm } from '@/features/archive-submission/components/ArchiveDynamicForm'
import {
  ArchiveSubmitSecuritySection,
  type FilePasswordDraftT,
  type PasswordModeT,
} from '@/features/archive-submission/components/ArchiveSubmitSecuritySection'
import {
  activeArchiveFieldConfigsQueryOptions,
  archiveSubmitPrepareQueryOptions,
  useSubmitArchiveMutation,
} from '@/features/archive-submission/queries'
import type { ArchiveFieldValueSnapshotT } from '@/features/archive-submission/types'
import { translateError } from '@/lib/utils/translate-error'

interface ArchiveSubmitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string | null
  dossierName?: string
  onSuccess?: () => void
}

function validateRequiredFields(
  fields: Array<{ fieldKey: string; label: string; isRequired: boolean }>,
  values: ArchiveFieldValueSnapshotT,
): string | null {
  for (const field of fields) {
    if (!field.isRequired) continue
    const value = values[field.fieldKey]
    if (value === null || value === undefined) return field.label
    if (typeof value === 'string' && value.trim() === '') return field.label
  }
  return null
}

function buildInitialFileSecurity(
  files: Array<{ id: string; securityLevelId: string | null }>,
): Record<string, string | null> {
  const next: Record<string, string | null> = {}
  for (const file of files) {
    next[file.id] = file.securityLevelId
  }
  return next
}

function buildInitialFilePasswords(
  files: Array<{ id: string }>,
): Record<string, FilePasswordDraftT> {
  const next: Record<string, FilePasswordDraftT> = {}
  for (const file of files) {
    next[file.id] = { mode: 'inherit', password: '', confirm: '' }
  }
  return next
}

function emptyPasswordDraft(): FilePasswordDraftT {
  return { mode: 'inherit', password: '', confirm: '' }
}

export function ArchiveSubmitDialog({
  open,
  onOpenChange,
  dossierId,
  dossierName,
  onSuccess,
}: ArchiveSubmitDialogProps) {
  const { t } = useTranslation('archive-submission')
  const [fieldValues, setFieldValues] = useState<ArchiveFieldValueSnapshotT>({})
  const [dossierSecurityLevelId, setDossierSecurityLevelId] = useState<string | null>(
    null,
  )
  const [fileSecurityById, setFileSecurityById] = useState<Record<string, string | null>>(
    {},
  )
  const [dossierPasswordMode, setDossierPasswordMode] = useState<PasswordModeT>('inherit')
  const [dossierPassword, setDossierPassword] = useState('')
  const [dossierPasswordConfirm, setDossierPasswordConfirm] = useState('')
  const [filePasswordById, setFilePasswordById] = useState<
    Record<string, FilePasswordDraftT>
  >({})
  const submitMutation = useSubmitArchiveMutation()
  const preparedSeedDossierIdRef = useRef<string | null>(null)

  const { data: fields = [], isPending, isError } = useQuery({
    ...activeArchiveFieldConfigsQueryOptions(),
    enabled: open,
  })

  const {
    data: prepareData,
    isPending: isPreparePending,
    isError: isPrepareError,
  } = useQuery({
    ...archiveSubmitPrepareQueryOptions(open ? dossierId : null),
  })

  const pdfFiles = prepareData?.files ?? []

  function resetPasswordState() {
    setDossierPasswordMode('inherit')
    setDossierPassword('')
    setDossierPasswordConfirm('')
    setFilePasswordById({})
  }

  useEffect(() => {
    if (!open) {
      preparedSeedDossierIdRef.current = null
      setFieldValues({})
      setDossierSecurityLevelId(null)
      setFileSecurityById({})
      resetPasswordState()
    }
  }, [open])

  useEffect(() => {
    if (!open || !prepareData || !dossierId) return
    if (preparedSeedDossierIdRef.current === dossierId) return
    preparedSeedDossierIdRef.current = dossierId

    setDossierSecurityLevelId(prepareData.dossierSecurityLevelId)
    setFileSecurityById(buildInitialFileSecurity(prepareData.files))
    setFilePasswordById(buildInitialFilePasswords(prepareData.files))
    setFieldValues(prepareData.suggestedFieldValues ?? {})
    setDossierPasswordMode('inherit')
    setDossierPassword('')
    setDossierPasswordConfirm('')
  }, [open, prepareData, dossierId])

  const securityReady = useMemo(() => {
    if (!dossierSecurityLevelId) return false
    for (const file of pdfFiles) {
      const levelId = fileSecurityById[file.id]
      if (!levelId) return false
    }
    return true
  }, [dossierSecurityLevelId, fileSecurityById, pdfFiles])

  function handleFileSecurityChange(fileId: string, value: string | null) {
    setFileSecurityById((prev) => ({ ...prev, [fileId]: value }))
  }

  function handleFilePasswordChange(fileId: string, patch: Partial<FilePasswordDraftT>) {
    setFilePasswordById((prev) => ({
      ...prev,
      [fileId]: {
        ...(prev[fileId] ?? emptyPasswordDraft()),
        ...patch,
      },
    }))
  }

  function handleApplyDossierLevelToAll() {
    if (!dossierSecurityLevelId) return
    setFileSecurityById((prev) => {
      const next = { ...prev }
      for (const file of pdfFiles) {
        next[file.id] = dossierSecurityLevelId
      }
      return next
    })
  }

  function validatePasswords(): string | null {
    if (dossierPasswordMode === 'custom') {
      const password = dossierPassword.trim()
      if (!password) return t('security.passwordRequired')
      if (password !== dossierPasswordConfirm.trim()) {
        return t('security.passwordMismatch')
      }
    }

    for (const file of pdfFiles) {
      const draft = filePasswordById[file.id] ?? emptyPasswordDraft()
      if (draft.mode !== 'custom') continue
      const password = draft.password.trim()
      if (!password) return t('security.passwordRequired')
      if (password !== draft.confirm.trim()) return t('security.passwordMismatch')
    }
    return null
  }

  async function handleSubmit() {
    if (!dossierId || !dossierSecurityLevelId) return

    const missingLabel = validateRequiredFields(fields, fieldValues)
    if (missingLabel) {
      toast.error(t('form.requiredField', { field: missingLabel }))
      return
    }

    if (!securityReady) {
      toast.error(t('security.missingFileLevel'))
      return
    }

    const passwordError = validatePasswords()
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    const fileSecurityLevels = pdfFiles.map((file) => {
      const draft = filePasswordById[file.id] ?? emptyPasswordDraft()
      return {
        fileId: file.id,
        securityLevelId: fileSecurityById[file.id]!,
        ...(draft.mode === 'custom'
          ? { accessPassword: draft.password.trim() }
          : {}),
        ...(draft.mode === 'clear' ? { clearAccessPassword: true } : {}),
      }
    })

    try {
      await submitMutation.mutateAsync({
        dossierId,
        payload: {
          fieldValues,
          securityLevelId: dossierSecurityLevelId,
          ...(dossierPasswordMode === 'custom'
            ? { accessPassword: dossierPassword.trim() }
            : {}),
          ...(dossierPasswordMode === 'clear' ? { clearAccessPassword: true } : {}),
          fileSecurityLevels,
        },
      })
      toast.success(t('submit.success'))
      resetPasswordState()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  const formLoading = isPending || isPreparePending
  const formError = isError || isPrepareError
  const canSubmit =
    Boolean(dossierId) &&
    !submitMutation.isPending &&
    !formLoading &&
    !formError &&
    fields.length > 0 &&
    securityReady

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('submit.title')}</DialogTitle>
          <DialogDescription>
            {dossierName
              ? t('submit.descriptionWithName', { name: dossierName })
              : t('submit.description')}
          </DialogDescription>
        </DialogHeader>

        {formLoading ? (
          <p className="text-sm text-muted-foreground">{t('form.loading')}</p>
        ) : null}

        {formError ? (
          <p className="text-sm text-destructive">{t('form.loadFailed')}</p>
        ) : null}

        {!formLoading && !formError && fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('submit.noFields')}</p>
        ) : null}

        {!formLoading && !formError && fields.length > 0 && prepareData ? (
          <>
            <ArchiveDynamicForm
              fields={fields}
              value={fieldValues}
              onChange={setFieldValues}
              disabled={submitMutation.isPending}
            />
            <ArchiveSubmitSecuritySection
              dossierSecurityLevelId={dossierSecurityLevelId}
              onDossierSecurityLevelChange={setDossierSecurityLevelId}
              dossierPasswordMode={dossierPasswordMode}
              onDossierPasswordModeChange={setDossierPasswordMode}
              dossierPassword={dossierPassword}
              onDossierPasswordChange={setDossierPassword}
              dossierPasswordConfirm={dossierPasswordConfirm}
              onDossierPasswordConfirmChange={setDossierPasswordConfirm}
              dossierHasOwnPassword={prepareData.dossierPasswordSource === 'own'}
              files={pdfFiles}
              fileSecurityById={fileSecurityById}
              onFileSecurityChange={handleFileSecurityChange}
              filePasswordById={filePasswordById}
              onFilePasswordChange={handleFilePasswordChange}
              onApplyDossierLevelToAll={handleApplyDossierLevelToAll}
              disabled={submitMutation.isPending}
            />
          </>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {t('submit.action')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
