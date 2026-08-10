import { useQuery } from '@tanstack/react-query'
import { FileArchive, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import type { ArchiveWarehouseExportModeT } from '@/features/archive-warehouse/api/archiveWarehouseExportClient'
import {
  checkDossierExportRequirements,
  exportDossiersDipByIds,
  exportDossiersMetadataByIds,
} from '@/features/archive-warehouse/api/archiveWarehouseExportClient'
import { metadataExportPresetOptionsQueryOptions } from '@/features/data-config/queries'
import {
  verifyDossierAccess,
  verifyFileAccess,
  verifySecurityLevelAccess,
} from '@/features/security-level/api/securityLevelClient'
import { SecurityAccessPasswordDialog } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import { getPasswordRequiredFromError } from '@/features/security-level/lib/passwordRequired'
import {
  clearDossierAccessToken,
  clearFileAccessToken,
  clearSecurityLevelAccessToken,
  setDossierAccessToken,
  setFileAccessToken,
  setSecurityLevelAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'
import { translateError } from '@/lib/utils/translate-error'

const DEFAULT_PRESET_VALUE = 'default'

type ExportRequestT = {
  mode: ArchiveWarehouseExportModeT
  presetId?: string
}

type PendingPasswordChallengeT =
  | { scope: 'dossier'; dossierId: string }
  | { scope: 'file'; fileId: string; securityLevelId?: string }
  | { scope: 'level'; securityLevelId: string }
  | { scope: 'zip'; dossierId: string }

export function ArchiveWarehouseExportDialog({
  open,
  onOpenChange,
  dossierIds,
  dossierNames,
  onExported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierIds: Array<string>
  dossierNames?: Array<string>
  onExported?: () => void
}) {
  const { t } = useTranslation('archive-warehouse')
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_VALUE)
  const [isExporting, setIsExporting] = useState(false)
  const [exportingMode, setExportingMode] =
    useState<ArchiveWarehouseExportModeT | null>(null)
  const [exportRequest, setExportRequest] = useState<ExportRequestT | null>(
    null,
  )
  const [pendingPassword, setPendingPassword] =
    useState<PendingPasswordChallengeT | null>(null)
  const [passwordError, setPasswordError] = useState<string>()
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false)
  const unlockedDuringExportRef = useRef(new Set<string>())
  /** Passwords collected before download (dossierId → plaintext). */
  const passwordByDossierRef = useRef<Map<string, string>>(new Map())
  /** Dossiers still needing a ZIP password before download starts. */
  const zipPassQueueRef = useRef<Array<string>>([])
  /** Resume point after unlocking access mid-check. */
  const checkResumeIndexRef = useRef(0)

  const { data: presets = [], isLoading: isLoadingPresets } = useQuery({
    ...metadataExportPresetOptionsQueryOptions(),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setSelectedPresetId(DEFAULT_PRESET_VALUE)
    setIsExporting(false)
    setExportingMode(null)
    setExportRequest(null)
    setPendingPassword(null)
    setPasswordError(undefined)
    setIsVerifyingPassword(false)
    unlockedDuringExportRef.current.clear()
    passwordByDossierRef.current = new Map()
    zipPassQueueRef.current = []
    checkResumeIndexRef.current = 0
  }, [open, dossierIds])

  if (dossierIds.length === 0) return null

  const isExportingMetadata = isExporting && exportingMode === 'metadata'
  const isExportingDip = isExporting && exportingMode === 'dip'
  const downloadName =
    dossierIds.length === 1
      ? dossierNames?.[0] || `dossier-${dossierIds[0]}`
      : `export-${dossierIds.length}-dossiers`

  function clearExportTokens(ids: Iterable<string>) {
    for (const key of ids) {
      if (key.startsWith('file:')) clearFileAccessToken(key.slice(5))
      else if (key.startsWith('level:'))
        clearSecurityLevelAccessToken(key.slice(6))
      else clearDossierAccessToken(key)
    }
  }

  function stopExportFlow() {
    clearExportTokens(unlockedDuringExportRef.current)
    unlockedDuringExportRef.current.clear()
    passwordByDossierRef.current = new Map()
    zipPassQueueRef.current = []
    checkResumeIndexRef.current = 0
    setExportRequest(null)
    setPendingPassword(null)
    setPasswordError(undefined)
    setIsExporting(false)
    setExportingMode(null)
  }

  function challengeKey(challenge: PendingPasswordChallengeT): string {
    if (challenge.scope === 'dossier') return challenge.dossierId
    if (challenge.scope === 'zip') return `zip:${challenge.dossierId}`
    if (challenge.scope === 'file') return `file:${challenge.fileId}`
    return `level:${challenge.securityLevelId}`
  }

  function dossierLabel(dossierId: string): string {
    const index = dossierIds.indexOf(dossierId)
    if (index >= 0 && dossierNames?.[index]) return dossierNames[index]!
    return `dossier-${dossierId}`
  }

  function promptNextZipPassword() {
    const nextId = zipPassQueueRef.current[0]
    if (!nextId) {
      void downloadAll(exportRequest!)
      return
    }
    setPendingPassword({ scope: 'zip', dossierId: nextId })
    setPasswordError(undefined)
  }

  async function downloadAll(request: ExportRequestT) {
    setIsExporting(true)
    setExportingMode(request.mode)
    setPendingPassword(null)

    const passwords = Object.fromEntries(passwordByDossierRef.current)

    try {
      if (request.mode === 'metadata') {
        await exportDossiersMetadataByIds(dossierIds, downloadName, {
          presetId: request.presetId,
          dossierAccessPasswords: passwords,
        })
      } else {
        await exportDossiersDipByIds(dossierIds, downloadName, {
          dossierAccessPasswords: passwords,
        })
      }
      clearExportTokens(unlockedDuringExportRef.current)
      unlockedDuringExportRef.current.clear()
      passwordByDossierRef.current = new Map()
      zipPassQueueRef.current = []
      setExportRequest(null)
      toast.success(
        dossierIds.length > 1
          ? t('export.successMulti', { count: dossierIds.length })
          : t('export.success'),
      )
      onExported?.()
      onOpenChange(false)
    } catch (error) {
      stopExportFlow()
      const message = translateError(
        error instanceof Error ? error : new Error(t('export.failed')),
      )
      if (
        message.includes('ZIP_PIN_REQUIRED') ||
        /đặt mã PIN cá nhân/i.test(message)
      ) {
        toast.error(t('export.zipPinRequired'))
        return
      }
      toast.error(message)
    } finally {
      setIsExporting(false)
      setExportingMode(null)
    }
  }

  /**
   * Phase 1: check each dossier (no download). Collect ZIP password needs.
   * Phase 2: prompt for each needed password.
   * Phase 3: download all ZIPs.
   */
  async function collectPasswordsThenExport(request: ExportRequestT) {
    setIsExporting(true)
    setExportingMode(request.mode)
    setPasswordError(undefined)

    const needZip: Array<string> = [...zipPassQueueRef.current]

    try {
      for (let i = checkResumeIndexRef.current; i < dossierIds.length; i += 1) {
        const id = dossierIds[i]!
        checkResumeIndexRef.current = i
        const known = passwordByDossierRef.current.get(id)

        try {
          const check = await checkDossierExportRequirements(
            id,
            request.mode,
            known,
          )
          if (check.needsDossierPassword && !known) {
            if (!needZip.includes(id)) needZip.push(id)
          }
        } catch (error) {
          const passwordRequired = getPasswordRequiredFromError(error)
          if (passwordRequired) {
            let challenge: PendingPasswordChallengeT | null = null
            if (
              passwordRequired.scope === 'dossier' &&
              passwordRequired.dossierId
            ) {
              challenge = {
                scope: 'dossier',
                dossierId: passwordRequired.dossierId,
              }
            } else if (
              passwordRequired.scope === 'file' &&
              passwordRequired.fileId
            ) {
              challenge = {
                scope: 'file',
                fileId: passwordRequired.fileId,
                securityLevelId: passwordRequired.securityLevelId,
              }
            } else if (
              passwordRequired.scope === 'level' &&
              passwordRequired.securityLevelId
            ) {
              challenge = {
                scope: 'level',
                securityLevelId: passwordRequired.securityLevelId,
              }
            }

            if (challenge) {
              const key = challengeKey(challenge)
              if (unlockedDuringExportRef.current.has(key)) {
                stopExportFlow()
                toast.error(t('export.passwordRetryFailed'))
                return
              }
              zipPassQueueRef.current = needZip
              setPendingPassword(challenge)
              setIsExporting(false)
              setExportingMode(null)
              return
            }
          }

          const message = translateError(
            error instanceof Error ? error : new Error(t('export.failed')),
          )
          if (
            message.includes('ZIP_PIN_REQUIRED') ||
            /đặt mã PIN cá nhân/i.test(message)
          ) {
            stopExportFlow()
            toast.error(t('export.zipPinRequired'))
            return
          }
          stopExportFlow()
          toast.error(message)
          return
        }
      }

      checkResumeIndexRef.current = dossierIds.length
      zipPassQueueRef.current = needZip.filter(
        (id) => !passwordByDossierRef.current.has(id),
      )

      if (zipPassQueueRef.current.length > 0) {
        setIsExporting(false)
        setExportingMode(null)
        promptNextZipPassword()
        return
      }

      await downloadAll(request)
    } finally {
      // downloadAll / stopExportFlow manage flags; leave alone if waiting for password
    }
  }

  async function runExport(mode: ArchiveWarehouseExportModeT) {
    if (dossierIds.length === 0 || isExporting || exportRequest) return

    const request: ExportRequestT = {
      mode,
      presetId:
        selectedPresetId !== DEFAULT_PRESET_VALUE
          ? selectedPresetId
          : undefined,
    }
    passwordByDossierRef.current = new Map()
    zipPassQueueRef.current = []
    checkResumeIndexRef.current = 0
    setExportRequest(request)
    await collectPasswordsThenExport(request)
  }

  async function submitAccessPassword(password: string) {
    if (!exportRequest || !pendingPassword) return

    setIsVerifyingPassword(true)
    setPasswordError(undefined)
    try {
      if (pendingPassword.scope === 'zip') {
        passwordByDossierRef.current.set(pendingPassword.dossierId, password)

        // Same shared level password often unlocks the rest — verify quietly.
        const remaining = zipPassQueueRef.current.filter(
          (id) => id !== pendingPassword.dossierId,
        )
        for (const otherId of remaining) {
          try {
            const check = await checkDossierExportRequirements(
              otherId,
              exportRequest.mode,
              password,
            )
            if (!check.needsDossierPassword) {
              passwordByDossierRef.current.set(otherId, password)
            }
          } catch {
            // keep in queue
          }
        }

        zipPassQueueRef.current = zipPassQueueRef.current.filter(
          (id) => !passwordByDossierRef.current.has(id),
        )
        setPendingPassword(null)
        if (zipPassQueueRef.current.length > 0) {
          promptNextZipPassword()
        } else {
          await downloadAll(exportRequest)
        }
        return
      }

      if (pendingPassword.scope === 'dossier') {
        const result = await verifyDossierAccess({
          dossierId: pendingPassword.dossierId,
          password,
        })
        setDossierAccessToken(
          pendingPassword.dossierId,
          result.token,
          result.expiresIn,
        )
        // Same plaintext often unlocks ZIP for dossier-password mode.
        passwordByDossierRef.current.set(pendingPassword.dossierId, password)
      } else if (pendingPassword.scope === 'file') {
        const result = await verifyFileAccess({
          fileId: pendingPassword.fileId,
          securityLevelId: pendingPassword.securityLevelId,
          password,
        })
        setFileAccessToken(
          pendingPassword.fileId,
          result.token,
          result.expiresIn,
        )
      } else {
        const result = await verifySecurityLevelAccess({
          securityLevelId: pendingPassword.securityLevelId,
          password,
        })
        setSecurityLevelAccessToken(
          pendingPassword.securityLevelId,
          result.token,
          result.expiresIn,
        )
        // Level shared password — apply to all dossiers not yet set.
        for (const id of dossierIds) {
          if (!passwordByDossierRef.current.has(id)) {
            passwordByDossierRef.current.set(id, password)
          }
        }
      }

      unlockedDuringExportRef.current.add(challengeKey(pendingPassword))
      setPendingPassword(null)
      await collectPasswordsThenExport(exportRequest)
    } catch (error) {
      setPasswordError(
        translateError(
          error instanceof Error ? error : new Error(t('export.failed')),
        ),
      )
    } finally {
      setIsVerifyingPassword(false)
    }
  }

  const passwordDossierId =
    pendingPassword?.scope === 'dossier' || pendingPassword?.scope === 'zip'
      ? pendingPassword.dossierId
      : null
  const passwordDossierIndex = passwordDossierId
    ? dossierIds.indexOf(passwordDossierId)
    : -1
  const passwordDossierName = passwordDossierId
    ? dossierLabel(passwordDossierId)
    : ''
  const zipQueueTotal =
    zipPassQueueRef.current.length +
    (pendingPassword?.scope === 'zip' ? 1 : 0)
  const zipQueueCurrent =
    pendingPassword?.scope === 'zip'
      ? Math.max(
          1,
          dossierIds.filter((id) => passwordByDossierRef.current.has(id))
            .length + 1,
        )
      : 1
  const exportFlowActive = Boolean(exportRequest)

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={exportFlowActive ? undefined : onOpenChange}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('export.title')}</DialogTitle>
            <DialogDescription>
              {t('export.description', { count: dossierIds.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-4">
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label htmlFor="archive-export-preset">
                {t('export.presetLabel')}
              </Label>
              <Select
                value={selectedPresetId}
                disabled={exportFlowActive || isLoadingPresets}
                onValueChange={setSelectedPresetId}
              >
                <SelectTrigger id="archive-export-preset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_PRESET_VALUE}>
                    {t('export.defaultPresetOption')}
                  </SelectItem>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isLoadingPresets
                  ? t('export.loadingPresets')
                  : selectedPresetId === DEFAULT_PRESET_VALUE
                    ? t('export.defaultPresetHint')
                    : t('export.selectedPresetHint')}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('export.securityLevelDownloadHint')}
            </p>

            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start gap-3 px-4 py-3"
              onClick={() => void runExport('metadata')}
              disabled={exportFlowActive}
            >
              {isExportingMetadata ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet
                  className="size-5 text-muted-foreground"
                  aria-hidden
                />
              )}
              <div className="flex flex-col items-start gap-0.5 text-left">
                <span className="font-medium">
                  {t('export.metadataOption')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('export.metadataOptionDescription')}
                </span>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start gap-3 px-4 py-3"
              onClick={() => void runExport('dip')}
              disabled={exportFlowActive}
            >
              {isExportingDip ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <FileArchive
                  className="size-5 text-muted-foreground"
                  aria-hidden
                />
              )}
              <div className="flex flex-col items-start gap-0.5 text-left">
                <span className="font-medium">{t('export.dipOption')}</span>
                <span className="text-xs text-muted-foreground">
                  {t('export.dipOptionDescription')}
                </span>
              </div>
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={exportFlowActive}
            >
              {t('export.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SecurityAccessPasswordDialog
        key={pendingPassword ? challengeKey(pendingPassword) : 'closed'}
        open={Boolean(pendingPassword)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isVerifyingPassword) stopExportFlow()
        }}
        title={
          pendingPassword?.scope === 'zip'
            ? t('export.zipPasswordCollectTitle', {
                current: zipQueueCurrent,
                total: Math.max(zipQueueTotal, zipQueueCurrent),
              })
            : pendingPassword?.scope === 'file'
              ? t('export.filePasswordTitle')
              : pendingPassword?.scope === 'level'
                ? t('export.levelPasswordTitle')
                : t('export.passwordTitle', {
                    current: Math.max(passwordDossierIndex + 1, 1),
                    total: dossierIds.length,
                  })
        }
        description={
          pendingPassword?.scope === 'zip'
            ? t('export.zipPasswordCollectDescription', {
                name: passwordDossierName,
              })
            : pendingPassword?.scope === 'dossier'
              ? t('export.passwordDescription', { name: passwordDossierName })
              : pendingPassword?.scope === 'file'
                ? t('export.filePasswordDescription')
                : t('export.levelPasswordDescription')
        }
        errorMessage={passwordError}
        onSubmit={submitAccessPassword}
        isPending={isVerifyingPassword}
        closeOnSubmit={false}
      />
    </>
  )
}
