import { useQuery } from '@tanstack/react-query'
import { AlertCircle, FileArchive, FileSpreadsheet, Info, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  const [exportProgress, setExportProgress] = useState<{
    completed: number
    total: number
    currentDossierId?: string
  } | null>(null)
  const [failedDossierIds, setFailedDossierIds] = useState<Array<string>>([])
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
    setExportProgress(null)
    setFailedDossierIds([])
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
      if (key.startsWith('file:')) clearFileAccessToken('warehouse', key.slice(5))
      else if (key.startsWith('level:'))
        clearSecurityLevelAccessToken('warehouse', key.slice(6))
      else clearDossierAccessToken('warehouse', key)
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
    setExportProgress(null)
    setFailedDossierIds([])
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

  async function downloadAll(
    request: ExportRequestT,
    targetDossierIds = dossierIds,
  ) {
    setIsExporting(true)
    setExportingMode(request.mode)
    setPendingPassword(null)
    setFailedDossierIds([])
    setExportProgress({ completed: 0, total: targetDossierIds.length })

    const passwords = Object.fromEntries(passwordByDossierRef.current)

    try {
      const result =
        request.mode === 'metadata'
          ? await exportDossiersMetadataByIds(targetDossierIds, downloadName, {
              presetId: request.presetId,
              dossierAccessPasswords: passwords,
              onProgress: (p) => setExportProgress(p),
              onItemError: (id) =>
                setFailedDossierIds((prev) => [...prev, id]),
            })
          : await exportDossiersDipByIds(targetDossierIds, downloadName, {
              dossierAccessPasswords: passwords,
              onProgress: (p) => setExportProgress(p),
              onItemError: (id) =>
                setFailedDossierIds((prev) => [...prev, id]),
            })

      clearExportTokens(unlockedDuringExportRef.current)
      unlockedDuringExportRef.current.clear()
      passwordByDossierRef.current = new Map()
      zipPassQueueRef.current = []

      if (result.failedDossierIds.length === 0) {
        setExportRequest(null)
        toast.success(
          targetDossierIds.length > 1
            ? t('export.successMulti', { count: targetDossierIds.length })
            : t('export.success'),
        )
        onExported?.()
        onOpenChange(false)
      } else {
        toast.error(
          `Đã tải ${result.successCount}/${targetDossierIds.length} file. Có ${result.failedDossierIds.length} file chưa tải thành công (có thể do trình duyệt chặn).`,
        )
      }
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
          'warehouse',
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
          'warehouse',
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
          'warehouse',
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

            {exportFlowActive && exportProgress && (
              <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between text-xs font-medium text-primary">
                  <span>Đang tải file ZIP ({exportProgress.completed}/{exportProgress.total})</span>
                  <span>{Math.round((exportProgress.completed / Math.max(exportProgress.total, 1)) * 100)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-in-out"
                    style={{
                      width: `${Math.round((exportProgress.completed / Math.max(exportProgress.total, 1)) * 100)}%`,
                    }}
                  />
                </div>
                {exportProgress.currentDossierId && (
                  <p className="truncate text-xs text-muted-foreground">
                    Đang xuất: {dossierLabel(exportProgress.currentDossierId)}
                  </p>
                )}
              </div>
            )}

            {dossierIds.length > 1 && exportFlowActive && (
              <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
                <Info className="size-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-sm font-semibold">Lưu ý trình duyệt:</AlertTitle>
                <AlertDescription className="text-xs">
                  Nếu trình duyệt (Chrome/Edge) hiển thị thông báo <b>"Cho phép tải nhiều file từ trang này?"</b>, vui lòng chọn <b>Cho phép (Allow)</b> để tải đầy đủ tất cả các file ZIP.
                </AlertDescription>
              </Alert>
            )}

            {failedDossierIds.length > 0 && !isExporting && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="size-4" />
                <AlertTitle>Có {failedDossierIds.length} file ZIP chưa tải thành công</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col gap-2">
                  <p className="text-xs">Có thể do trình duyệt chặn tải tự động liên tiếp. Bạn có thể bấm thử tải lại bên dưới.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (exportRequest) {
                        void downloadAll(exportRequest, failedDossierIds)
                      }
                    }}
                  >
                    Thử tải lại {failedDossierIds.length} file bị lỗi
                  </Button>
                </AlertDescription>
              </Alert>
            )}
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
