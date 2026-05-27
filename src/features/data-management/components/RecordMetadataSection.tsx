import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { buildRecordInfoFields } from '@/features/data-management/lib/recordInfo'
import { useSaveDossierMetadataMutation } from '@/features/data-management/queries'
import type {
  DataDossierMetadataT,
  DataRecordInfoFieldT,
} from '@/features/data-management/types'

function RecordInfoReadOnlyItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function createEmptyRecordInfoField(index: number): DataRecordInfoFieldT {
  return {
    name: `field_${Date.now()}_${index}`,
    value: '',
  }
}

function buildMetadataFromFields(
  baseMetadata: DataDossierMetadataT,
  fields: Array<DataRecordInfoFieldT>,
): DataDossierMetadataT {
  const nextMetadata: DataDossierMetadataT = {
    ...baseMetadata,
    ho_so_id: undefined,
    trang_thai_ho_so: undefined,
    general_fields: [],
  }

  const generalFields: Array<DataRecordInfoFieldT> = []

  for (const field of fields) {
    if (field.name === 'ho_so_id') {
      nextMetadata.ho_so_id = field.value
      continue
    }
    if (field.name === 'trang_thai_ho_so') {
      nextMetadata.trang_thai_ho_so = field.value
      continue
    }
    generalFields.push(field)
  }

  if (generalFields.length > 0) {
    nextMetadata.general_fields = generalFields
  }

  return nextMetadata
}

export function RecordMetadataSection({
  metadata,
  role,
  dossierId,
}: {
  metadata: DataDossierMetadataT
  role: string
  dossierId: string
}) {
  const { t } = useTranslation('data-management')
  const permissions = getPermissionsByRole(role as DataManagementRole)
  const canManage = permissions.canEditRecordMetadataFields
  const saveMutation = useSaveDossierMetadataMutation(role as DataManagementRole)
  const initialFields = useMemo(() => buildRecordInfoFields(metadata), [metadata])
  const [fields, setFields] = useState(initialFields)

  useEffect(() => {
    setFields(initialFields)
  }, [initialFields])

  function getFieldLabel(name: string) {
    if (name === 'ho_so_id') return t('recordDetail.hoSoId')
    if (name === 'trang_thai_ho_so') return t('recordDetail.trangThaiHoSo')
    return name
  }

  function handleAddField() {
    setFields((prev) => [...prev, createEmptyRecordInfoField(prev.length)])
  }

  function handleDeleteField(index: number) {
    setFields((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  async function handleSave() {
    try {
      const nextMetadata = buildMetadataFromFields(metadata, fields)
      await saveMutation.mutateAsync({ dossierId, metadata: nextMetadata })
      toast.success(t('metadata.saveSuccess'))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('metadata.saveError')
      toast.error(message)
    }
  }

  return (
    <Card variant="bordered">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3">
        <CardTitle className="text-base">
          {t('recordDetail.summaryTitle')}
        </CardTitle>
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleAddField}
            disabled={saveMutation.isPending}
          >
            <Plus className="size-4" aria-hidden />
            {t('recordDetail.addField')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        {fields.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field, index) =>
              canManage ? (
                <div
                  key={`${field.name}-${index}`}
                  className="flex items-start gap-2 sm:col-span-2"
                >
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <Input
                      value={field.name}
                      onChange={(event) =>
                        setFields((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder={t('recordDetail.fieldNamePlaceholder')}
                      disabled={saveMutation.isPending}
                    />
                    <Input
                      value={field.value}
                      onChange={(event) =>
                        setFields((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, value: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder={t('recordDetail.fieldValuePlaceholder')}
                      disabled={saveMutation.isPending}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteField(index)}
                    disabled={saveMutation.isPending}
                    aria-label={t('recordDetail.deleteField')}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ) : (
                <RecordInfoReadOnlyItem
                  key={`${field.name}-${index}`}
                  label={getFieldLabel(field.name)}
                  value={field.value}
                />
              ),
            )}
          </div>
        ) : null}

        {canManage ? (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              className="gap-2"
              onClick={() => void handleSave()}
              disabled={saveMutation.isPending}
            >
              <Save className="size-4" aria-hidden />
              {saveMutation.isPending
                ? t('metadata.saving')
                : role === 'qc'
                  ? t('metadata.approve')
                  : t('metadata.save')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
