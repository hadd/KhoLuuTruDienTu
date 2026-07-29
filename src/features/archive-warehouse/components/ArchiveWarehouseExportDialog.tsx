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
  exportDossiersDipByIds,
  exportDossiersMetadataByIds,
} from '@/features/archive-warehouse/api/archiveWarehouseExportClient'
import { metadataExportPresetOptionsQueryOptions } from '@/features/data-config/queries'
import { verifyDossierAccess } from '@/features/security-level/api/securityLevelClient'
import { SecurityAccessPasswordDialog } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import { getPasswordRequiredFromError } from '@/features/security-level/lib/passwordRequired'
import {
  clearDossierAccessToken,
  setDossierAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'
import { translateError } from '@/lib/utils/translate-error'

const DEFAULT_PRESET_VALUE = 'default'

type ExportRequestT = {
  mode: ArchiveWarehouseExportModeT
  presetId?: string
}

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
  const [pendingPasswordDossierId, setPendingPasswordDossierId] = useState<
    string | null
  >(null)
  const [passwordError, setPasswordError] = useState<string>()
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false)
  const unlockedDuringExportRef = useRef(new Set<string>())

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
    setPendingPasswordDossierId(null)
    setPasswordError(undefined)
    setIsVerifyingPassword(false)
    unlockedDuringExportRef.current.clear()
  }, [open, dossierIds])

  if (dossierIds.length === 0) return null

  const isExportingMetadata = isExporting && exportingMode === 'metadata'
  const isExportingDip = isExporting && exportingMode === 'dip'
  const downloadName =
    dossierIds.length === 1
      ? dossierNames?.[0] || `dossier-${dossierIds[0]}`
      : `export-${dossierIds.length}-dossiers`

  function clearExportTokens(ids: Iterable<string>) {
    for (const dossierId of ids) clearDossierAccessToken(dossierId)
  }

  function stopExportFlow() {
    clearExportTokens(unlockedDuringExportRef.current)
    unlockedDuringExportRef.current.clear()
    setExportRequest(null)
    setPendingPasswordDossierId(null)
    setPasswordError(undefined)
    setIsExporting(false)
    setExportingMode(null)
  }

  async function attemptExport(request: ExportRequestT) {
    setIsExporting(true)
    setExportingMode(request.mode)

    try {
      if (request.mode === 'metadata') {
        await exportDossiersMetadataByIds(dossierIds, downloadName, {
          presetId: request.presetId,
        })
      } else {
        await exportDossiersDipByIds(dossierIds, downloadName)
      }
      clearExportTokens(dossierIds)
      unlockedDuringExportRef.current.clear()
      setExportRequest(null)
      setPendingPasswordDossierId(null)
      toast.success(t('export.success'))
      onExported?.()
      onOpenChange(false)
    } catch (error) {
      const passwordRequired = getPasswordRequiredFromError(error)
      const requiredDossierId = passwordRequired?.dossierId
      if (
        passwordRequired?.scope === 'dossier' &&
        requiredDossierId &&
        dossierIds.includes(requiredDossierId)
      ) {
        if (unlockedDuringExportRef.current.has(requiredDossierId)) {
          stopExportFlow()
          toast.error(t('export.passwordRetryFailed'))
          return
        }
        setPendingPasswordDossierId(requiredDossierId)
        setPasswordError(undefined)
        return
      }
      stopExportFlow()
      toast.error(
        translateError(
          error instanceof Error ? error : new Error(t('export.failed')),
        ),
      )
    } finally {
      setIsExporting(false)
      setExportingMode(null)
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
    setExportRequest(request)
    await attemptExport(request)
  }

  async function submitDossierPassword(password: string) {
    if (!pendingPasswordDossierId || !exportRequest) return

    const dossierId = pendingPasswordDossierId
    setIsVerifyingPassword(true)
    setPasswordError(undefined)
    try {
      const result = await verifyDossierAccess({ dossierId, password })
      setDossierAccessToken(dossierId, result.token, result.expiresIn)
      unlockedDuringExportRef.current.add(dossierId)
      setPendingPasswordDossierId(null)
      await attemptExport(exportRequest)
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

  const passwordDossierIndex = pendingPasswordDossierId
    ? dossierIds.indexOf(pendingPasswordDossierId)
    : -1
  const passwordDossierName =
    passwordDossierIndex >= 0
      ? dossierNames?.[passwordDossierIndex] ||
        `dossier-${pendingPasswordDossierId}`
      : ''
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
        key={pendingPasswordDossierId ?? 'closed'}
        open={Boolean(pendingPasswordDossierId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isVerifyingPassword) stopExportFlow()
        }}
        title={t('export.passwordTitle', {
          current: passwordDossierIndex + 1,
          total: dossierIds.length,
        })}
        description={t('export.passwordDescription', {
          name: passwordDossierName,
        })}
        errorMessage={passwordError}
        onSubmit={submitDossierPassword}
        isPending={isVerifyingPassword}
        closeOnSubmit={false}
      />
    </>
  )
}
