import {
  Loader2,
  PenLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getDigitalSignStatus,
  type DigitalSignFileStatus,
  type VisualSignaturePayload,
} from '@/features/digital-sign/api/digitalSignClient'
import { SignFilePlacementPanel } from '@/features/digital-sign/components/SignFilePlacementPanel'
import {
  buildSingleDossierQueue,
  runDigitalSignQueue,
  summarizeQueue,
  type DigitalSignQueueItem,
} from '@/features/digital-sign/lib/signingRunner'
import {
  detectAllActiveCaAdapters,
  getSignAgentInstallHint,
  type CaAdapter,
  type CaCertificate,
} from '@/lib/ca-sign/ca-adapter'
import {
  formatCertificateLabel,
} from '@/lib/ca-sign/certificateDisplay'
import { SIGN_AGENT_DOWNLOAD_URL } from '@/features/digital-sign/lib/ensureSignAgentReady'

const DEFAULT_PLACEMENT: VisualSignaturePayload = {
  pageNumber: 1,
  xRatio: 65,
  yRatio: 82,
  widthRatio: 32,
  heightRatio: 9,
  reason: 'I am the author of this document',
  location: '',
  appearanceType: 'standard',
}

export function DigitalSignDialog({
  open,
  onOpenChange,
  dossierId,
  dossierName,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  dossierName?: string
  onCompleted?: () => void
}) {
  const { t } = useTranslation('data-management')
  const [activeAdapters, setActiveAdapters] = useState<Array<CaAdapter>>([])
  const [certificates, setCertificates] = useState<Array<CaCertificate>>([])
  const [selectedThumbprint, setSelectedThumbprint] = useState('')
  const [loadingCerts, setLoadingCerts] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [running, setRunning] = useState(false)
  const [queue, setQueue] = useState<Array<DigitalSignQueueItem>>([])
  const [pendingFiles, setPendingFiles] = useState<Array<DigitalSignFileStatus>>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [placements, setPlacements] = useState<Record<string, VisualSignaturePayload>>({})
  const [reason, setReason] = useState(DEFAULT_PLACEMENT.reason ?? '')
  const [location, setLocation] = useState(DEFAULT_PLACEMENT.location ?? '')

  useEffect(() => {
    if (!open) {
      setActiveAdapters([])
      setQueue([])
      setSelectedThumbprint('')
      setCertificates([])
      setPendingFiles([])
      setSelectedIds(new Set())
      setActiveFileId(null)
      setPlacements({})
      return
    }

    let cancelled = false
    async function init() {
      const adapters = await detectAllActiveCaAdapters()
      if (cancelled) return
      setActiveAdapters(adapters)

      setLoadingFiles(true)
      try {
        const status = await getDigitalSignStatus(dossierId)
        if (cancelled) return
        const unsigned = status.files.filter(
          (f) => !f.isSigned && f.fileName.toLowerCase().endsWith('.pdf'),
        )
        setPendingFiles(unsigned)
        const ids = new Set(unsigned.map((f) => f.id))
        setSelectedIds(ids)
        setActiveFileId(unsigned[0]?.id ?? null)
        const nextPlacements: Record<string, VisualSignaturePayload> = {}
        for (const f of unsigned) {
          nextPlacements[f.id] = { ...DEFAULT_PLACEMENT }
        }
        setPlacements(nextPlacements)
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Không tải được danh sách file chờ ký',
          )
        }
      } finally {
        if (!cancelled) setLoadingFiles(false)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [dossierId, open])

  const loadCertificates = useCallback(async () => {
    if (!activeAdapters.length) return
    setLoadingCerts(true)
    try {
      const allCerts: Array<CaCertificate> = []
      for (const adp of activeAdapters) {
        try {
          const certs = await adp.listCertificates()
          certs.forEach((c) => allCerts.push({ ...c, providerId: adp.providerId }))
        } catch {
          // continue
        }
      }
      setCertificates(allCerts)
      if (allCerts[0]) setSelectedThumbprint(allCerts[0].thumbprint)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('digitalSign.certLoadError', { defaultValue: 'Lỗi đọc chứng thư số' }),
      )
    } finally {
      setLoadingCerts(false)
    }
  }, [activeAdapters, t])

  useEffect(() => {
    if (open && activeAdapters.length > 0) void loadCertificates()
  }, [activeAdapters, loadCertificates, open])

  const selectedCertificate = certificates.find(
    (cert) => cert.thumbprint === selectedThumbprint,
  )
  const progress = summarizeQueue(queue)

  const panelFiles = useMemo(
    () =>
      pendingFiles.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        filePath: f.filePath,
        fileUrl: f.fileUrl,
      })),
    [pendingFiles],
  )

  function updatePlacement(fileId: string, patch: Partial<VisualSignaturePayload>) {
    setPlacements((prev) => ({
      ...prev,
      [fileId]: {
        ...DEFAULT_PLACEMENT,
        ...prev[fileId],
        ...patch,
        reason,
        location,
      },
    }))
  }

  async function handleSign() {
    if (!selectedCertificate?.certificateBase64) {
      toast.error('Thiếu chứng thư số hợp lệ từ Sohoa Sign Agent.')
      return
    }
    const targetAdapter =
      activeAdapters.find((a) => a.providerId === selectedCertificate.providerId) ??
      activeAdapters[0]
    if (!targetAdapter) return

    const chosen = pendingFiles.filter((f) => selectedIds.has(f.id))
    if (!chosen.length) {
      toast.info('Hãy chọn ít nhất một file PDF để ký')
      return
    }

    const missingPlacement = chosen.find(
      (f) => placements[f.id]?.xRatio === undefined || placements[f.id]?.yRatio === undefined,
    )
    if (missingPlacement) {
      toast.error(`Chưa đặt vị trí chữ ký cho file: ${missingPlacement.fileName}`)
      setActiveFileId(missingPlacement.id)
      return
    }

    setRunning(true)
    try {
      const items = await buildSingleDossierQueue(dossierId, {
        certificateSubject: selectedCertificate.subject,
        certificateIssuer: selectedCertificate.issuer,
        certificateBase64: selectedCertificate.certificateBase64,
        files: chosen.map((f) => ({
          fileId: f.id,
          visualSignature: {
            ...placements[f.id],
            reason,
            location,
          },
        })),
      })
      setQueue(items)

      if (!items.length) {
        toast.info(t('digitalSign.noPendingFiles', { defaultValue: 'Không có tệp PDF nào chờ ký' }))
        return
      }

      const finalItems = await runDigitalSignQueue({
        items,
        adapter: targetAdapter,
        certificate: selectedCertificate,
        onUpdate: setQueue,
      })

      const summary = summarizeQueue(finalItems)
      if (summary.failed === 0 && summary.completed > 0) {
        toast.success(t('digitalSign.completed', { defaultValue: 'Ký số thành công!' }))
        onCompleted?.()
        onOpenChange(false)
      } else if (summary.completed > 0) {
        toast.warning(t('digitalSign.partialCompleted', { defaultValue: 'Hoàn thành ký số một phần tệp' }))
        onCompleted?.()
      } else {
        const firstError = finalItems.find((i) => i.error)?.error
        toast.error(firstError ?? t('digitalSign.failed', { defaultValue: 'Ký số thất bại' }))
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('digitalSign.prepareError', { defaultValue: 'Lỗi chuẩn bị tài liệu ký số' }),
      )
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/30 p-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-5 text-red-600" aria-hidden />
            Ký số — chọn file và đặt vị trí
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-foreground">
            {dossierName
              ? `Hồ sơ: ${dossierName}. Chọn từng file PDF, xem nội dung và nhấp để đặt vị trí chữ ký.`
              : 'Chọn từng file PDF, xem nội dung và nhấp để đặt vị trí chữ ký.'}
          </DialogDescription>
        </DialogHeader>

        {!activeAdapters.length ? (
          <div className="space-y-4 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <PenLine className="h-6 w-6 text-red-600" />
            </div>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {getSignAgentInstallHint()}
            </p>
            <Button asChild variant="outline">
              <a href={SIGN_AGENT_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                Tải Sohoa Sign Agent
              </a>
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="space-y-2 border-b px-5 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Label className="shrink-0 text-xs font-medium">Chứng thư:</Label>
                <Select
                  value={selectedThumbprint}
                  onValueChange={setSelectedThumbprint}
                  disabled={loadingCerts || running}
                >
                  <SelectTrigger className="h-8 min-w-0 max-w-[280px] text-xs">
                    <SelectValue placeholder="Chọn chứng thư CA..." />
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(90vw,360px)]">
                    {certificates.map((cert) => (
                      <SelectItem
                        key={cert.thumbprint}
                        value={cert.thumbprint}
                        className="text-xs"
                        title={cert.subject}
                      >
                        <span className="block max-w-[320px] truncate">
                          {formatCertificateLabel(cert)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="sign-reason" className="text-xs font-medium">
                    Lý do ký (Reason)
                  </Label>
                  <Input
                    id="sign-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="VD: I am the author of this document"
                    className="h-8 text-xs"
                    disabled={running}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Hiện trên chữ ký PDF ở dòng Reason
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sign-location" className="text-xs font-medium">
                    Địa điểm ký (Location)
                  </Label>
                  <Input
                    id="sign-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="VD: TP. Hồ Chí Minh (để trống nếu không cần)"
                    className="h-8 text-xs"
                    disabled={running}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Hiện trên chữ ký PDF ở dòng Location
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loadingFiles ? (
                <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Đang tải danh sách file...
                </div>
              ) : (
                <SignFilePlacementPanel
                  files={panelFiles}
                  selectedIds={selectedIds}
                  activeFileId={activeFileId}
                  placements={placements}
                  stampLabel={selectedCertificate?.subject}
                  onToggleFile={(fileId, checked) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev)
                      if (checked) next.add(fileId)
                      else next.delete(fileId)
                      return next
                    })
                    if (checked) setActiveFileId(fileId)
                  }}
                  onSelectActive={setActiveFileId}
                  onPlacementChange={updatePlacement}
                />
              )}

              {queue.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <Label className="text-xs font-semibold">Tiến độ ký</Label>
                  <ul className="max-h-28 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                    {queue.map((item) => (
                      <li key={item.fileId} className="flex justify-between gap-2">
                        <span className="truncate">{item.fileName}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {t(`digitalSign.queueStatus.${item.status}`, {
                            defaultValue: item.status,
                          })}
                          {item.error ? `: ${item.error}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between border-t bg-muted/20 p-4 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Đã chọn {selectedIds.size}/{pendingFiles.length} file
            {queue.length
              ? ` · Đã ký ${progress.completed}/${progress.total}`
              : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={running}
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => void handleSign()}
              disabled={
                !activeAdapters.length ||
                !selectedCertificate ||
                running ||
                selectedIds.size === 0
              }
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Đang ký số...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 size-4" aria-hidden />
                  Ký {selectedIds.size} file đã chọn
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
