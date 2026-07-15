import { useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Upload } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { WatermarkCanvasValues } from '@/features/watermark-config/components/WatermarkPlacementCanvas'
import { WatermarkPlacementCanvas } from '@/features/watermark-config/components/WatermarkPlacementCanvas'
import {
  useCreateWatermarkPlacement,
  useUpdateWatermarkPlacement,
  useUploadWatermarkImage,
  watermarkPlacementDetailQueryOptions,
} from '@/features/watermark-config/queries'
import type { WatermarkPlacementFormT } from '@/features/watermark-config/schemas'
import {
  WATERMARK_POSITION_VALUES,
  watermarkPlacementFormFieldsSchema,
  watermarkPlacementFormSchema,
} from '@/features/watermark-config/schemas'
import type {
  WatermarkPlacementRecordT,
  WatermarkPositionT,
} from '@/features/watermark-config/types'
import type { AppFormApi } from '@/lib/forms'
import { FormField, useAppForm } from '@/lib/forms'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function asPosition(value: string | undefined | null): WatermarkPositionT {
  if (
    value &&
    (WATERMARK_POSITION_VALUES as ReadonlyArray<string>).includes(value)
  ) {
    return value as WatermarkPositionT
  }
  return 'center'
}

function getDefaultFormValues(
  detail?: WatermarkPlacementRecordT | null,
): WatermarkPlacementFormT {
  return {
    name: detail?.name ?? '',
    imageEnabled: detail?.imageEnabled ?? false,
    imageAssetId: detail?.imageAssetId ?? null,
    imageOpacity: Math.min(50, Math.max(5, detail?.imageOpacity ?? 30)),
    imagePosition: asPosition(detail?.imagePosition),
    imageSizePercent: Math.min(
      100,
      Math.max(5, detail?.imageSizePercent ?? 30),
    ),
    imageOffsetXPercent: detail?.imageOffsetXPercent ?? null,
    imageOffsetYPercent: detail?.imageOffsetYPercent ?? null,
    imageRotationDegrees: Math.min(
      180,
      Math.max(-180, detail?.imageRotationDegrees ?? 0),
    ),
    imageStamps: detail?.imageStamps ?? null,
    textEnabled: detail?.textEnabled ?? false,
    textContent: detail?.textContent ?? null,
    textOpacity: Math.min(50, Math.max(5, detail?.textOpacity ?? 30)),
    textPosition: asPosition(detail?.textPosition),
    textSizePercent: Math.min(100, Math.max(5, detail?.textSizePercent ?? 20)),
    textOffsetXPercent: detail?.textOffsetXPercent ?? null,
    textOffsetYPercent: detail?.textOffsetYPercent ?? null,
    textRotationDegrees: Math.min(
      180,
      Math.max(-180, detail?.textRotationDegrees ?? 0),
    ),
    textStamps: detail?.textStamps ?? null,
  }
}

function toPayload(value: WatermarkPlacementFormT) {
  const imageStamps =
    value.imageStamps && value.imageStamps.length > 0 ? value.imageStamps : null
  const textStamps =
    value.textStamps && value.textStamps.length > 0 ? value.textStamps : null

  const clearImageOffsets = value.imagePosition !== 'custom' && !imageStamps
  const clearTextOffsets = value.textPosition !== 'custom' && !textStamps

  return {
    name: value.name.trim(),
    imageEnabled: value.imageEnabled,
    imageAssetId: value.imageAssetId,
    imageOpacity: value.imageOpacity,
    imagePosition: value.imagePosition,
    imageSizePercent: value.imageSizePercent,
    imageOffsetXPercent: clearImageOffsets ? null : value.imageOffsetXPercent,
    imageOffsetYPercent: clearImageOffsets ? null : value.imageOffsetYPercent,
    imageRotationDegrees: value.imageRotationDegrees,
    imageStamps,
    textEnabled: value.textEnabled,
    textContent: value.textContent?.trim() ? value.textContent.trim() : null,
    textOpacity: value.textOpacity,
    textPosition: value.textPosition,
    textSizePercent: value.textSizePercent,
    textOffsetXPercent: clearTextOffsets ? null : value.textOffsetXPercent,
    textOffsetYPercent: clearTextOffsets ? null : value.textOffsetYPercent,
    textRotationDegrees: value.textRotationDegrees,
    textStamps,
  }
}

function mapValidationMessage(
  t: (key: string) => string,
  message: string | undefined,
): string {
  if (!message) return t('errors.validation')
  if (
    message === 'imageAssetRequired' ||
    message === 'textContentRequired' ||
    message === 'customOffsetRequired'
  ) {
    return t(`form.validation.${message}`)
  }
  return message
}

function applyPresetOffsets(position: WatermarkPositionT): {
  offsetXPercent: number | null
  offsetYPercent: number | null
  stamps: null
} {
  if (position === 'custom') {
    return {
      offsetXPercent: 50,
      offsetYPercent: 50,
      stamps: null,
    }
  }
  return {
    offsetXPercent: null,
    offsetYPercent: null,
    stamps: null,
  }
}

type WatermarkPlacementEditorProps = {
  placementId: string
  readOnly?: boolean
  onCancel: () => void
  onSuccess: () => void
}

export function WatermarkPlacementEditor({
  placementId,
  readOnly = false,
  onCancel,
  onSuccess,
}: WatermarkPlacementEditorProps) {
  const { t } = useTranslation('watermark-config')
  const isEditing = placementId !== 'new'
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(
    null,
  )

  React.useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  const detailQuery = useQuery({
    ...watermarkPlacementDetailQueryOptions(placementId),
    enabled: isEditing,
  })

  const createMutation = useCreateWatermarkPlacement()
  const updateMutation = useUpdateWatermarkPlacement()
  const uploadMutation = useUploadWatermarkImage()

  const detail = isEditing ? (detailQuery.data ?? null) : null
  const formKey = `${placementId}-${detail?.updatedAt ?? 'draft'}`

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadMutation.isPending

  if (isEditing && detailQuery.isLoading && !detail) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {t('loading')}
      </div>
    )
  }

  if (isEditing && detailQuery.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-muted-foreground">
          {t('errors.loadFailed')}
        </p>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('actions.backToList')}
        </Button>
      </div>
    )
  }

  return (
    <WatermarkPlacementEditorForm
      key={formKey}
      isEditing={isEditing}
      readOnly={readOnly}
      defaultValues={getDefaultFormValues(detail)}
      imagePreviewUrl={imagePreviewUrl}
      imageLabel={detail?.imageAsset?.originalFilename ?? null}
      isSaving={isSaving}
      fileInputRef={fileInputRef}
      onCancel={onCancel}
      onPreviewUrlChange={(url) => {
        setImagePreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      }}
      onUpload={async (file) => {
        const record = await uploadMutation.mutateAsync(file)
        return {
          assetId: record.id,
          filename: record.originalFilename,
        }
      }}
      onSubmit={async (value) => {
        const parsed = watermarkPlacementFormSchema.safeParse(value)
        if (!parsed.success) {
          const issue = parsed.error.issues[0]
          toast.error(mapValidationMessage(t, issue.message))
          return
        }

        const payload = toPayload(parsed.data)
        if (isEditing) {
          await updateMutation.mutateAsync({
            placementId,
            payload,
          })
        } else {
          await createMutation.mutateAsync(payload)
        }
        onSuccess()
      }}
    />
  )
}

function WatermarkPlacementEditorForm({
  isEditing,
  readOnly = false,
  defaultValues,
  imagePreviewUrl,
  imageLabel,
  isSaving,
  fileInputRef,
  onCancel,
  onPreviewUrlChange,
  onUpload,
  onSubmit,
}: {
  isEditing: boolean
  readOnly?: boolean
  defaultValues: WatermarkPlacementFormT
  imagePreviewUrl: string | null
  imageLabel: string | null
  isSaving: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onCancel: () => void
  onPreviewUrlChange: (url: string | null) => void
  onUpload: (file: File) => Promise<{ assetId: string; filename: string }>
  onSubmit: (value: WatermarkPlacementFormT) => Promise<void>
}) {
  const { t } = useTranslation('watermark-config')
  const [selectedImageLabel, setSelectedImageLabel] = React.useState<
    string | null
  >(imageLabel)

  const form = useAppForm({
    schema: watermarkPlacementFormFieldsSchema,
    defaultValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  const values = useStore(
    form.store,
    (state) => (state as { values: WatermarkPlacementFormT }).values,
  )

  const applyCanvasPatch = (patch: Partial<WatermarkCanvasValues>) => {
    for (const [key, value] of Object.entries(patch)) {
      form.setFieldValue(key as keyof WatermarkPlacementFormT, value as never)
    }
  }

  const handlePositionChange = (
    field: 'imagePosition' | 'textPosition',
    position: WatermarkPositionT,
  ) => {
    form.setFieldValue(field, position)
    const cleared = applyPresetOffsets(position)
    if (field === 'imagePosition') {
      form.setFieldValue('imageOffsetXPercent', cleared.offsetXPercent)
      form.setFieldValue('imageOffsetYPercent', cleared.offsetYPercent)
      form.setFieldValue('imageStamps', cleared.stamps)
    } else {
      form.setFieldValue('textOffsetXPercent', cleared.offsetXPercent)
      form.setFieldValue('textOffsetYPercent', cleared.offsetYPercent)
      form.setFieldValue('textStamps', cleared.stamps)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden overscroll-none">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onCancel}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isEditing ? t('form.editTitle') : t('form.createTitle')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('canvas.hint')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onCancel}
          >
            {t('form.actions.cancel')}
          </Button>
          {readOnly ? null : (
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void form.handleSubmit()}
            >
              {isSaving ? t('form.actions.saving') : t('form.actions.save')}
            </Button>
          )}
        </div>
      </div>

      <form
        className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden lg:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!readOnly) void form.handleSubmit()
        }}
      >
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <CardTitle>{t('form.sections.general')}</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain">
            <FormField
              form={form}
              name="name"
              label={t('form.fields.name.label')}
              placeholder={t('form.fields.name.placeholder')}
            />

            <section className="space-y-3">
              <h3 className="text-sm font-medium">
                {t('form.sections.image')}
              </h3>
              <FormField
                form={form}
                name="imageEnabled"
                label={t('form.fields.imageEnabled.label')}
                render={(field) => (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(field.state.value)}
                      onCheckedChange={(checked) => field.handleChange(checked)}
                      disabled={isSaving}
                    />
                  </div>
                )}
              />

              {values.imageEnabled ? (
                <>
                  <div className="space-y-2">
                    <Label>{t('form.fields.imageAssetId.label')}</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/svg+xml,.png,.svg"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ''
                          if (!file) return
                          if (file.size > MAX_IMAGE_BYTES) {
                            toast.error(t('form.upload.hint'))
                            return
                          }
                          const localUrl = URL.createObjectURL(file)
                          onPreviewUrlChange(localUrl)
                          void onUpload(file).then((result) => {
                            form.setFieldValue('imageAssetId', result.assetId)
                            form.setFieldValue('imageEnabled', true)
                            setSelectedImageLabel(result.filename)
                          })
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving || readOnly}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="size-4" />
                        {isSaving
                          ? t('form.upload.uploading')
                          : t('form.upload.button')}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {selectedImageLabel ??
                          t('form.fields.imageAssetId.empty')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('form.upload.hint')}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <SliderField
                      form={form}
                      name="imageOpacity"
                      label={t('form.fields.imageOpacity.label')}
                      min={5}
                      max={50}
                      step={1}
                      disabled={isSaving}
                      formatValue={(value) => `${value}%`}
                    />
                    <SliderField
                      form={form}
                      name="imageSizePercent"
                      label={t('form.fields.imageSizePercent.label')}
                      min={5}
                      max={100}
                      step={1}
                      disabled={isSaving}
                      formatValue={(value) => `${value}%`}
                    />
                    <PositionField
                      form={form}
                      name="imagePosition"
                      label={t('form.fields.imagePosition.label')}
                      disabled={isSaving}
                      onChange={(position) =>
                        handlePositionChange('imagePosition', position)
                      }
                    />
                    <RotationSliderField
                      form={form}
                      name="imageRotationDegrees"
                      label={t('form.fields.imageRotationDegrees.label')}
                      disabled={isSaving}
                    />
                  </div>
                </>
              ) : null}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium">{t('form.sections.text')}</h3>
              <FormField
                form={form}
                name="textEnabled"
                label={t('form.fields.textEnabled.label')}
                render={(field) => (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(field.state.value)}
                      onCheckedChange={(checked) => field.handleChange(checked)}
                      disabled={isSaving}
                    />
                  </div>
                )}
              />

              {values.textEnabled ? (
                <>
                  <FormField
                    form={form}
                    name="textContent"
                    label={t('form.fields.textContent.label')}
                    placeholder={t('form.fields.textContent.placeholder')}
                    render={(field) => (
                      <Input
                        value={field.state.value ?? ''}
                        placeholder={t('form.fields.textContent.placeholder')}
                        disabled={isSaving}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          const next = event.target.value
                          field.handleChange(next.length > 0 ? next : null)
                        }}
                      />
                    )}
                  />
                  <div className="space-y-4">
                    <SliderField
                      form={form}
                      name="textOpacity"
                      label={t('form.fields.textOpacity.label')}
                      min={5}
                      max={50}
                      step={1}
                      disabled={isSaving}
                      formatValue={(value) => `${value}%`}
                    />
                    <SliderField
                      form={form}
                      name="textSizePercent"
                      label={t('form.fields.textSizePercent.label')}
                      min={5}
                      max={100}
                      step={1}
                      disabled={isSaving}
                      formatValue={(value) => `${value}%`}
                    />
                    <PositionField
                      form={form}
                      name="textPosition"
                      label={t('form.fields.textPosition.label')}
                      disabled={isSaving}
                      onChange={(position) =>
                        handlePositionChange('textPosition', position)
                      }
                    />
                    <RotationSliderField
                      form={form}
                      name="textRotationDegrees"
                      label={t('form.fields.textRotationDegrees.label')}
                      disabled={isSaving}
                    />
                  </div>
                </>
              ) : null}
            </section>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <CardTitle>{t('canvas.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0">
            <WatermarkPlacementCanvas
              values={values}
              imagePreviewUrl={imagePreviewUrl}
              imageLabel={selectedImageLabel}
              disabled={isSaving}
              onChange={applyCanvasPatch}
            />
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

function SliderField({
  form,
  name,
  label,
  min,
  max,
  step = 1,
  disabled,
  formatValue,
}: {
  form: AppFormApi<WatermarkPlacementFormT>
  name: keyof WatermarkPlacementFormT & string
  label: string
  min: number
  max: number
  step?: number
  disabled?: boolean
  formatValue?: (value: number) => string
}) {
  return (
    <FormField
      form={form}
      name={name}
      label={label}
      render={(field) => {
        const raw = Number(field.state.value)
        const value = Number.isFinite(raw)
          ? Math.min(max, Math.max(min, Math.round(raw)))
          : min

        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {formatValue ? formatValue(value) : value}
              </span>
            </div>
            <Slider
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              value={[value]}
              onValueChange={(next) => {
                field.handleChange(next[0] ?? min)
              }}
            />
          </div>
        )
      }}
    />
  )
}

function RotationSliderField({
  form,
  name,
  label,
  disabled,
}: {
  form: AppFormApi<WatermarkPlacementFormT>
  name: 'imageRotationDegrees' | 'textRotationDegrees'
  label: string
  disabled?: boolean
}) {
  const min = -180
  const max = 180

  return (
    <FormField
      form={form}
      name={name}
      label={label}
      render={(field) => {
        const raw = Number(field.state.value)
        const value = Number.isFinite(raw)
          ? Math.min(max, Math.max(min, Math.round(raw)))
          : 0
        const centerPercent = ((0 - min) / (max - min)) * 100
        const valuePercent = ((value - min) / (max - min)) * 100
        const rangeLeft = Math.min(centerPercent, valuePercent)
        const rangeWidth = Math.abs(valuePercent - centerPercent)

        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{value}°</span>
            </div>
            <div className="relative flex w-full touch-none items-center select-none py-1">
              <Slider
                min={min}
                max={max}
                step={1}
                disabled={disabled}
                value={[value]}
                onValueChange={(next) => {
                  field.handleChange(next[0] ?? 0)
                }}
                className="[&_[data-slot=slider-range]]:opacity-0"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 overflow-hidden rounded-full"
              >
                <div
                  className="absolute top-0 h-full rounded-full bg-primary"
                  style={{
                    left: `${rangeLeft}%`,
                    width: `${rangeWidth}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>-180°</span>
              <span>0°</span>
              <span>180°</span>
            </div>
          </div>
        )
      }}
    />
  )
}

function PositionField({
  form,
  name,
  label,
  disabled,
  onChange,
}: {
  form: AppFormApi<WatermarkPlacementFormT>
  name: 'imagePosition' | 'textPosition'
  label: string
  disabled?: boolean
  onChange: (position: WatermarkPositionT) => void
}) {
  const { t } = useTranslation('watermark-config')

  return (
    <FormField
      form={form}
      name={name}
      label={label}
      render={(field) => (
        <Select
          value={String(field.state.value)}
          disabled={disabled}
          onValueChange={(value) => onChange(value as WatermarkPositionT)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WATERMARK_POSITION_VALUES.map((position) => (
              <SelectItem key={position} value={position}>
                {t(`positions.${position}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  )
}
