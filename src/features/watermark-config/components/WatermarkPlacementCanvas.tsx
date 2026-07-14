import { Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { WatermarkStampFormT } from '@/features/watermark-config/schemas'
import type { WatermarkPositionT } from '@/features/watermark-config/types'
import { cn } from '@/lib/utils/cn'

type CanvasLayer = 'image' | 'text'

type DragTarget =
  | { layer: CanvasLayer; mode: 'single' }
  | { layer: CanvasLayer; mode: 'stamp'; index: number }

export type WatermarkCanvasValues = {
  imageEnabled: boolean
  imagePosition: WatermarkPositionT
  imageSizePercent: number
  imageOpacity: number
  imageOffsetXPercent: number | null
  imageOffsetYPercent: number | null
  imageRotationDegrees: number
  imageStamps: Array<WatermarkStampFormT> | null
  textEnabled: boolean
  textContent: string | null
  textPosition: WatermarkPositionT
  textSizePercent: number
  textOpacity: number
  textOffsetXPercent: number | null
  textOffsetYPercent: number | null
  textRotationDegrees: number
  textStamps: Array<WatermarkStampFormT> | null
}

type WatermarkPlacementCanvasProps = {
  values: WatermarkCanvasValues
  imagePreviewUrl: string | null
  imageLabel: string | null
  disabled?: boolean
  onChange: (patch: Partial<WatermarkCanvasValues>) => void
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function presetStyle(position: WatermarkPositionT): React.CSSProperties {
  switch (position) {
    case 'top_left':
      return { left: '8%', top: '8%' }
    case 'top_right':
      return { left: '92%', top: '8%' }
    case 'bottom_left':
      return { left: '8%', top: '92%' }
    case 'bottom_right':
      return { left: '92%', top: '92%' }
    case 'tile_grid':
      return { left: '50%', top: '50%' }
    case 'custom':
      return { left: '50%', top: '50%' }
    case 'center':
    default:
      return { left: '50%', top: '50%' }
  }
}

function tilePositions(): Array<{ x: number; y: number }> {
  return [
    { x: 25, y: 25 },
    { x: 75, y: 25 },
    { x: 25, y: 75 },
    { x: 75, y: 75 },
    { x: 50, y: 50 },
  ]
}

export function WatermarkPlacementCanvas({
  values,
  imagePreviewUrl,
  imageLabel,
  disabled,
  onChange,
}: WatermarkPlacementCanvasProps) {
  const { t } = useTranslation('watermark-config')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<DragTarget | null>(null)
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 })

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const fitA4 = (boxWidth: number, boxHeight: number) => {
      if (boxWidth <= 0 || boxHeight <= 0) {
        setCanvasSize({ width: 0, height: 0 })
        return
      }
      const ratio = 210 / 297
      let height = boxHeight
      let width = height * ratio
      if (width > boxWidth) {
        width = boxWidth
        height = width / ratio
      }
      setCanvasSize({
        width: Math.floor(width),
        height: Math.floor(height),
      })
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      fitA4(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(container)
    fitA4(container.clientWidth, container.clientHeight)
    return () => observer.disconnect()
  }, [])

  const updateFromPointer = React.useCallback(
    (event: React.PointerEvent | PointerEvent, target: DragTarget) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100)
      const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100)

      if (target.layer === 'image') {
        if (target.mode === 'single') {
          onChange({
            imagePosition: 'custom',
            imageOffsetXPercent: x,
            imageOffsetYPercent: y,
            imageStamps: null,
          })
          return
        }
        const next = [...(values.imageStamps ?? [])]
        next[target.index] = {
          offsetXPercent: x,
          offsetYPercent: y,
          rotationDegrees: next[target.index]?.rotationDegrees,
        }
        onChange({
          imagePosition: 'custom',
          imageStamps: next,
          imageOffsetXPercent: null,
          imageOffsetYPercent: null,
        })
        return
      }

      if (target.mode === 'single') {
        onChange({
          textPosition: 'custom',
          textOffsetXPercent: x,
          textOffsetYPercent: y,
          textStamps: null,
        })
        return
      }
      const next = [...(values.textStamps ?? [])]
      next[target.index] = {
        offsetXPercent: x,
        offsetYPercent: y,
        rotationDegrees: next[target.index]?.rotationDegrees,
      }
      onChange({
        textPosition: 'custom',
        textStamps: next,
        textOffsetXPercent: null,
        textOffsetYPercent: null,
      })
    },
    [onChange, values.imageStamps, values.textStamps],
  )

  React.useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragRef.current) return
      updateFromPointer(event, dragRef.current)
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [updateFromPointer])

  const startDrag = (event: React.PointerEvent, target: DragTarget) => {
    if (disabled) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = target
    updateFromPointer(event, target)
  }

  const imageUsesStamps =
    Array.isArray(values.imageStamps) && values.imageStamps.length > 0
  const textUsesStamps =
    Array.isArray(values.textStamps) && values.textStamps.length > 0
  const imageDraggable =
    values.imageEnabled &&
    (values.imagePosition === 'custom' || imageUsesStamps)
  const textDraggable =
    values.textEnabled && (values.textPosition === 'custom' || textUsesStamps)

  const addImageStamp = () => {
    if (disabled) return
    const next = [
      ...(values.imageStamps ?? []),
      {
        offsetXPercent: 50,
        offsetYPercent: 50,
        rotationDegrees: values.imageRotationDegrees,
      },
    ]
    onChange({
      imageEnabled: true,
      imagePosition: 'custom',
      imageStamps: next,
      imageOffsetXPercent: null,
      imageOffsetYPercent: null,
    })
  }

  const addTextStamp = () => {
    if (disabled) return
    const next = [
      ...(values.textStamps ?? []),
      {
        offsetXPercent: 50,
        offsetYPercent: 50,
        rotationDegrees: values.textRotationDegrees,
      },
    ]
    onChange({
      textEnabled: true,
      textPosition: 'custom',
      textStamps: next,
      textOffsetXPercent: null,
      textOffsetYPercent: null,
    })
  }

  const removeImageStamp = (index: number) => {
    const next = (values.imageStamps ?? []).filter((_, i) => i !== index)
    onChange({
      imageStamps: next.length > 0 ? next : null,
      ...(next.length === 0
        ? {
            imageOffsetXPercent: 50,
            imageOffsetYPercent: 50,
            imagePosition: 'custom' as const,
          }
        : {}),
    })
  }

  const removeTextStamp = (index: number) => {
    const next = (values.textStamps ?? []).filter((_, i) => i !== index)
    onChange({
      textStamps: next.length > 0 ? next : null,
      ...(next.length === 0
        ? {
            textOffsetXPercent: 50,
            textOffsetYPercent: 50,
            textPosition: 'custom' as const,
          }
        : {}),
    })
  }

  const renderImageNode = (
    key: string,
    style: React.CSSProperties,
    rotation: number,
    draggable: boolean,
    onPointerDown?: (event: React.PointerEvent) => void,
    onRemove?: () => void,
  ) => (
    <div
      key={key}
      className={cn(
        'absolute z-10 select-none',
        draggable
          ? 'cursor-grab active:cursor-grabbing'
          : 'pointer-events-none',
      )}
      style={{
        ...style,
        width: `${values.imageSizePercent}%`,
        opacity: values.imageOpacity / 100,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }}
      onPointerDown={onPointerDown}
    >
      {imagePreviewUrl ? (
        <img
          src={imagePreviewUrl}
          alt={imageLabel ?? 'watermark'}
          className="pointer-events-none h-auto w-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded border border-dashed border-sky-400/70 bg-sky-500/15 px-1 text-center text-[10px] font-medium text-sky-900">
          {imageLabel ?? t('canvas.imagePlaceholder')}
        </div>
      )}
      {onRemove ? (
        <button
          type="button"
          className="absolute -top-2 -right-2 z-30 rounded-full border border-border bg-background p-1 text-foreground shadow pointer-events-auto"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRemove()
          }}
          aria-label={t('form.stamps.remove')}
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </div>
  )

  const renderTextNode = (
    key: string,
    style: React.CSSProperties,
    rotation: number,
    content: string,
    draggable: boolean,
    onPointerDown?: (event: React.PointerEvent) => void,
    onRemove?: () => void,
  ) => (
    <div
      key={key}
      className={cn(
        'absolute z-20 max-w-[80%] select-none px-1 py-0.5',
        draggable
          ? 'cursor-grab active:cursor-grabbing'
          : 'pointer-events-none',
      )}
      style={{
        ...style,
        opacity: values.textOpacity / 100,
        fontSize: `${Math.max(10, values.textSizePercent * 0.35)}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }}
      onPointerDown={onPointerDown}
    >
      <span className="font-semibold tracking-wide text-foreground/80">
        {content}
      </span>
      {onRemove ? (
        <button
          type="button"
          className="absolute -top-2 -right-2 z-30 rounded-full border border-border bg-background p-1 text-foreground shadow pointer-events-auto"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRemove()
          }}
          aria-label={t('form.stamps.remove')}
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('canvas.hint')}</p>
        <div className="flex flex-wrap gap-2">
          {values.imageEnabled ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || (values.imageStamps?.length ?? 0) >= 20}
              onClick={addImageStamp}
            >
              <Plus className="size-4" />
              {t('canvas.addImageStamp')}
            </Button>
          ) : null}
          {values.textEnabled ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || (values.textStamps?.length ?? 0) >= 20}
              onClick={addTextStamp}
            >
              <Plus className="size-4" />
              {t('canvas.addTextStamp')}
            </Button>
          ) : null}
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
      >
        <div
          ref={canvasRef}
          className="relative overflow-visible rounded-md border border-border bg-[#f7f5f0] shadow-inner"
          style={{
            width: canvasSize.width || undefined,
            height: canvasSize.height || undefined,
          }}
        >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[length:24px_24px]" />

        {values.imageEnabled
          ? imageUsesStamps
            ? values.imageStamps!.map((stamp, index) =>
                renderImageNode(
                  `image-stamp-${index}`,
                  {
                    left: `${stamp.offsetXPercent}%`,
                    top: `${stamp.offsetYPercent}%`,
                  },
                  stamp.rotationDegrees ?? values.imageRotationDegrees,
                  imageDraggable,
                  (event) =>
                    startDrag(event, {
                      layer: 'image',
                      mode: 'stamp',
                      index,
                    }),
                  () => removeImageStamp(index),
                ),
              )
            : values.imagePosition === 'tile_grid'
              ? tilePositions().map((pos, index) =>
                  renderImageNode(
                    `image-tile-${index}`,
                    { left: `${pos.x}%`, top: `${pos.y}%` },
                    values.imageRotationDegrees,
                    false,
                  ),
                )
              : renderImageNode(
                  'image-single',
                  values.imagePosition === 'custom'
                    ? {
                        left: `${values.imageOffsetXPercent ?? 50}%`,
                        top: `${values.imageOffsetYPercent ?? 50}%`,
                      }
                    : presetStyle(values.imagePosition),
                  values.imageRotationDegrees,
                  imageDraggable,
                  imageDraggable
                    ? (event) =>
                        startDrag(event, { layer: 'image', mode: 'single' })
                    : undefined,
                  imageDraggable
                    ? () =>
                        onChange({
                          imageEnabled: false,
                          imageOffsetXPercent: null,
                          imageOffsetYPercent: null,
                          imageStamps: null,
                        })
                    : undefined,
                )
          : null}

        {values.textEnabled && values.textContent
          ? textUsesStamps
            ? values.textStamps!.map((stamp, index) =>
                renderTextNode(
                  `text-stamp-${index}`,
                  {
                    left: `${stamp.offsetXPercent}%`,
                    top: `${stamp.offsetYPercent}%`,
                  },
                  stamp.rotationDegrees ?? values.textRotationDegrees,
                  values.textContent!,
                  textDraggable,
                  (event) =>
                    startDrag(event, {
                      layer: 'text',
                      mode: 'stamp',
                      index,
                    }),
                  () => removeTextStamp(index),
                ),
              )
            : values.textPosition === 'tile_grid'
              ? tilePositions().map((pos, index) =>
                  renderTextNode(
                    `text-tile-${index}`,
                    { left: `${pos.x}%`, top: `${pos.y}%` },
                    values.textRotationDegrees,
                    values.textContent!,
                    false,
                  ),
                )
              : renderTextNode(
                  'text-single',
                  values.textPosition === 'custom'
                    ? {
                        left: `${values.textOffsetXPercent ?? 50}%`,
                        top: `${values.textOffsetYPercent ?? 50}%`,
                      }
                    : presetStyle(values.textPosition),
                  values.textRotationDegrees,
                  values.textContent,
                  textDraggable,
                  textDraggable
                    ? (event) =>
                        startDrag(event, { layer: 'text', mode: 'single' })
                    : undefined,
                  textDraggable
                    ? () =>
                        onChange({
                          textEnabled: false,
                          textOffsetXPercent: null,
                          textOffsetYPercent: null,
                          textStamps: null,
                        })
                    : undefined,
                )
          : null}

        {!values.imageEnabled && !values.textEnabled ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {t('canvas.empty')}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  )
}
