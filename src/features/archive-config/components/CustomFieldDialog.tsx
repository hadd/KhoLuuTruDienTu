import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
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
import { Textarea } from '@/components/ui/textarea'
import type {
  ArchiveFieldConfigT,
  ArchiveFieldTypeT,
} from '@/features/archive-config/types'
import { slugifyFieldKey } from '@/features/archive-config/lib/slugifyFieldKey'

const CUSTOM_FIELD_TYPES: Array<ArchiveFieldTypeT> = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'SELECT',
]

function InputFieldLabel({
  htmlFor,
  children,
  required = false,
}: {
  htmlFor?: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </Label>
  )
}

interface CustomFieldDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  field?: ArchiveFieldConfigT | null
  onSubmit: (payload: {
    fieldKey: string
    label: string
    fieldType: ArchiveFieldTypeT
    isRequired: boolean
    options: Array<{ value: string; label: string }>
  }) => Promise<void>
}

export function CustomFieldDialog({
  open,
  onOpenChange,
  field,
  onSubmit,
}: CustomFieldDialogProps) {
  const { t } = useTranslation('archive-config')
  const [label, setLabel] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldType, setFieldType] = useState<ArchiveFieldTypeT>('TEXT')
  const [isRequired, setIsRequired] = useState(false)
  const [optionsText, setOptionsText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLabel(field?.label ?? '')
    setFieldKey(field?.fieldKey ?? '')
    setFieldType(
      field?.fieldType && CUSTOM_FIELD_TYPES.includes(field.fieldType)
        ? field.fieldType
        : 'TEXT',
    )
    setIsRequired(field?.isRequired ?? false)
    setOptionsText(
      field?.options?.map((option) => `${option.value}|${option.label}`).join('\n') ?? '',
    )
  }, [open, field])

  useEffect(() => {
    if (field) return
    if (!label.trim()) return
    setFieldKey(slugifyFieldKey(label))
  }, [label, field])

  async function handleSubmit() {
    const trimmedLabel = label.trim()
    const trimmedKey = slugifyFieldKey(fieldKey.trim())
    if (!trimmedLabel || !trimmedKey) return

    const options =
      fieldType === 'SELECT'
        ? optionsText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const [value, optionLabel] = line.split('|')
              const resolvedValue = (value ?? '').trim()
              const resolvedLabel = (optionLabel ?? resolvedValue).trim()
              return { value: resolvedValue, label: resolvedLabel }
            })
            .filter((option) => option.value)
        : []

    setIsSubmitting(true)
    try {
      await onSubmit({
        fieldKey: trimmedKey,
        label: trimmedLabel,
        fieldType,
        isRequired,
        options,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {field ? t('customField.editTitle') : t('customField.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <InputFieldLabel htmlFor="archive-custom-label" required>
              {t('customField.label')}
            </InputFieldLabel>
            <Input
              id="archive-custom-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <InputFieldLabel htmlFor="archive-custom-key" required>
              {t('customField.fieldKey')}
            </InputFieldLabel>
            <Input
              id="archive-custom-key"
              value={fieldKey}
              onChange={(event) => setFieldKey(event.target.value)}
              onBlur={() => setFieldKey(slugifyFieldKey(fieldKey))}
            />
            <p className="text-xs text-muted-foreground">
              {field ? t('customField.fieldKeyEditHint') : t('customField.fieldKeyHint')}
            </p>
          </div>

          <div className="space-y-2">
            <InputFieldLabel required>{t('customField.type')}</InputFieldLabel>
            <Select
              value={fieldType}
              onValueChange={(value) => setFieldType(value as ArchiveFieldTypeT)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_FIELD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`fieldTypes.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fieldType === 'SELECT' ? (
            <div className="space-y-2">
              <Label htmlFor="archive-custom-options">{t('customField.options')}</Label>
              <Textarea
                id="archive-custom-options"
                value={optionsText}
                onChange={(event) => setOptionsText(event.target.value)}
                placeholder={t('customField.optionsPlaceholder')}
                rows={4}
              />
            </div>
          ) : null}

          <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5">
            <Checkbox
              id="archive-custom-required"
              checked={isRequired}
              onCheckedChange={(checked) => setIsRequired(checked === true)}
              aria-label={t('customField.required')}
            />
            <span className="text-sm text-muted-foreground">
              {t('customField.required')}
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !label.trim() || !fieldKey.trim()}
          >
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
