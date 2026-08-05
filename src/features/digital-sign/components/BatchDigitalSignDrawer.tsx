import {
  Loader2,
  Pause,
  PenLine,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  getDigitalSignStatus,
  type VisualSignaturePayload,
} from '@/features/digital-sign/api/digitalSignClient'
import {
  SignFilePlacementPanel,
  type SignablePdfFile,
} from '@/features/digital-sign/components/SignFilePlacementPanel'
import {
  buildBatchDossierQueue,
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
import { formatCertificateLabel } from '@/lib/ca-sign/certificateDisplay'
import { SIGN_AGENT_DOWNLOAD_URL } from '@/features/digital-sign/lib/ensureSignAgentReady'

const DEFAULT_PLACEMENT: VisualSignaturePayload = {
  pageNumber: 1,
  xRatio: 65,
  yRatio: 82,
  widthPx: 250,
  heightPx: 64,
  reason: 'Phê duyệt hồ sơ số hóa',
  location: 'TP. Hồ Chí Minh',
  appearanceType: 'standard',
}

export function BatchDigitalSignDrawer({
  open,
  onOpenChange,
  dossierIds,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierIds: Array<string>
  onCompleted?: () => void
}) {
  const { t } = useTranslation('data-management')
  const [activeAdapters, setActiveAdapters] = useState<Array<CaAdapter>>([])
  const [certificates, setCertificates] = useState<Array<CaCertificate>>([])
  const [selectedThumbprint, setSelectedThumbprint] = useState('')
  const [loadingCerts, setLoadingCerts] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const [queue, setQueue] = useState<Array<DigitalSignQueueItem>>([])
  const [pendingFiles, setPendingFiles] = useState<Array<SignablePdfFile>>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [placements, setPlacements] = useState<Record<string, VisualSignaturePayload>>({})
  const [reason, setReason] = useState(DEFAULT_PLACEMENT.reason ?? '')
  const [location, setLocation] = useState(DEFAULT_PLACEMENT.location ?? '')

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (!open) {
      setActiveAdapters([])
      setQueue([])
      setSelectedThumbprint('')
      setCertificates([])
      setPaused(false)
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
        const lists = await Promise.all(
          dossierIds.map(async (dossierId) => {
            const status = await getDigitalSignStatus(dossierId)
            return status.files
              .filter((f) => !f.isSigned && f.fileName.toLowerCase().endsWith('.pdf'))
              .map((f) => ({
                id: f.id,
                fileName: f.fileName,
                filePath: f.filePath,
                fileUrl: f.fileUrl,
                dossierId,
                dossierName: status.dossierName,
              }))
          }),
        )
        if (cancelled) return
        const flat = lists.flat()
        setPendingFiles(flat)
        setSelectedIds(new Set(flat.map((f) => f.id)))
        setActiveFileId(flat[0]?.id ?? null)
        const nextPlacements: Record<string, VisualSignaturePayload> = {}
        for (const f of flat) nextPlacements[f.id] = { ...DEFAULT_PLACEMENT }
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
  }, [dossierIds, open])

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

  const selectedDossierIds = useMemo(() => {
    const ids = new Set<string>()
    for (const f of pendingFiles) {
      if (selectedIds.has(f.id) && f.dossierId) ids.add(f.dossierId)
    }
    return [...ids]
  }, [pendingFiles, selectedIds])

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

    const missing = chosen.find(
      (f) => placements[f.id]?.xRatio === undefined || placements[f.id]?.yRatio === undefined,
    )
    if (missing) {
      toast.error(`Chưa đặt vị trí chữ ký cho file: ${missing.fileName}`)
      setActiveFileId(missing.id)
      return
    }

    setRunning(true)
    setPaused(false)
    try {
      const items = await buildBatchDossierQueue(selectedDossierIds, {
        certificateSubject: selectedCertificate.subject,
        certificateIssuer: selectedCertificate.issuer,
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
        shouldStop: () => pausedRef.current,
        onUpdate: setQueue,
      })

      const latest = summarizeQueue(finalItems)
      if (latest.completed > 0) onCompleted?.()
      if (latest.failed === 0 && latest.completed > 0) {
        toast.success(t('digitalSign.completed', { defaultValue: 'Ký số hàng loạt hoàn tất!' }))
      } else if (latest.completed > 0) {
        toast.warning(t('digitalSign.partialCompleted', { defaultValue: 'Ký số hoàn tất một phần' }))
      } else if (!pausedRef.current) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-4xl">
        <SheetHeader className="border-b bg-muted/30 p-5 pb-3">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-5 text-red-600" aria-hidden />
            Ký số hàng loạt — chọn file ({dossierIds.length} hồ sơ)
          </SheetTitle>
          <SheetDescription className="mt-1 text-xs text-muted-foreground">
            Chọn từng file PDF, xem nội dung và nhấp lên trang để đặt vị trí chữ ký.
          </SheetDescription>
        </SheetHeader>

        {!activeAdapters.length ? (
          <div className="my-auto space-y-4 p-6 text-center">
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
              <div className="flex min-w-0 max-w-[300px] items-center gap-2">
                <Label className="shrink-0 text-xs font-medium">Chứng thư:</Label>
                <Select
                  value={selectedThumbprint}
                  onValueChange={setSelectedThumbprint}
                  disabled={loadingCerts || running}
                >
                  <SelectTrigger className="h-8 min-w-0 max-w-[220px] text-xs">
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
              <div className="flex flex-wrap gap-2">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Lý do ký"
                  className="h-8 w-36 text-xs"
                />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Địa điểm"
                  className="h-8 w-32 text-xs"
                />
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
                  files={pendingFiles}
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
                <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                  {queue.map((item) => (
                    <li key={item.fileId} className="flex justify-between gap-2">
                      <span className="truncate">{item.fileName}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {item.status}
                        {item.error ? `: ${item.error}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        )}

        <SheetFooter className="flex items-center justify-between border-t bg-muted/20 p-4 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Đã chọn {selectedIds.size}/{pendingFiles.length} file
            {queue.length ? ` · Đã ký ${progress.completed}/${progress.total}` : ''}
          </p>
          <div className="flex items-center gap-2">
            {running ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? (
                  <>
                    <Play className="mr-1.5 size-3.5" />
                    Tiếp tục
                  </>
                ) : (
                  <>
                    <Pause className="mr-1.5 size-3.5" />
                    Tạm dừng
                  </>
                )}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={running && !paused}
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
