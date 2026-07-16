import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { activeArchiveFondsQueryOptions } from '@/features/archive-fond/queries'
import {
  inventoryFormSchema,
  type InventoryFormValues,
} from '@/features/inventory/schemas'
import {
  useCreateInventory,
  useUpdateInventory,
} from '@/features/inventory/queries'
import type { InventoryT } from '@/features/inventory/types'
import { FormField, useAppForm } from '@/lib/forms'

const emptyValues: InventoryFormValues = {
  id: '',
  number: '',
  name: '',
  fondId: '',
  submissionYear: new Date().getFullYear(),
  submittingUnit: '',
}

function toFormValues(inventory: InventoryT): InventoryFormValues {
  return {
    id: inventory.id,
    number: inventory.number,
    name: inventory.name,
    fondId: inventory.fondId,
    submissionYear: inventory.submissionYear,
    submittingUnit: inventory.submittingUnit,
  }
}

interface InventoryFormProps {
  inventory: InventoryT | null
  onClose: () => void
  readOnly?: boolean
}

function InventoryForm({ inventory, onClose, readOnly = false }: InventoryFormProps) {
  const { t } = useTranslation('inventory')
  const createInventory = useCreateInventory()
  const updateInventory = useUpdateInventory()
  const isEdit = inventory !== null
  const isPending = createInventory.isPending || updateInventory.isPending
  const isReadOnly = readOnly
  const { data: fondsData, isPending: isFondsPending, isError: isFondsError } =
    useQuery(activeArchiveFondsQueryOptions())
  const fonds = fondsData?.items ?? []

  const form = useAppForm({
    schema: inventoryFormSchema,
    defaultValues: inventory ? toFormValues(inventory) : emptyValues,
    onSubmit: async ({ value }) => {
      if (isEdit && inventory) {
        const { id: _id, ...updatePayload } = value
        await updateInventory.mutateAsync({
          id: inventory.id,
          payload: updatePayload,
        })
      } else {
        await createInventory.mutateAsync(value)
      }
      onClose()
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          form={form}
          name="id"
          label={t('form.fields.id.label')}
          placeholder={t('form.fields.id.placeholder')}
          disabled={isEdit || isReadOnly}
        />
        <FormField
          form={form}
          name="number"
          label={t('form.fields.number.label')}
          placeholder={t('form.fields.number.placeholder')}
          disabled={isReadOnly}
        />
        <FormField
          form={form}
          name="name"
          label={t('form.fields.name.label')}
          placeholder={t('form.fields.name.placeholder')}
          className="sm:col-span-2"
          disabled={isReadOnly}
        />
        <FormField
          form={form}
          name="fondId"
          label={t('form.fields.fondId.label')}
          render={(field) => (
            <Select
              value={(field.state.value as string) || ''}
              onValueChange={field.handleChange}
              disabled={
                isReadOnly || isFondsPending || isFondsError || fonds.length === 0
              }
            >
              <SelectTrigger aria-label={t('form.fields.fondId.label')}>
                <SelectValue
                  placeholder={
                    isFondsPending
                      ? t('form.fields.fondId.loading')
                      : isFondsError
                        ? t('form.fields.fondId.loadFailed')
                        : fonds.length === 0
                          ? t('form.fields.fondId.empty')
                          : t('form.fields.fondId.placeholder')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {fonds.map((fond) => (
                  <SelectItem key={fond.id} value={fond.id}>
                    {fond.fondName} ({fond.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FormField
          form={form}
          name="submissionYear"
          label={t('form.fields.submissionYear.label')}
          placeholder={t('form.fields.submissionYear.placeholder')}
          as="number"
          disabled={isReadOnly}
        />
        <FormField
          form={form}
          name="submittingUnit"
          label={t('form.fields.submittingUnit.label')}
          placeholder={t('form.fields.submittingUnit.placeholder')}
          className="sm:col-span-2"
          disabled={isReadOnly}
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          {isReadOnly ? t('form.actions.close') : t('form.actions.cancel')}
        </Button>
        {!isReadOnly ? (
          <Button type="submit" disabled={isPending}>
            {isPending
              ? t('form.actions.saving')
              : isEdit
                ? t('form.actions.update')
                : t('form.actions.create')}
          </Button>
        ) : null}
      </DialogFooter>
    </form>
  )
}

interface InventoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inventory: InventoryT | null
  readOnly?: boolean
}

export function InventoryFormDialog({
  open,
  onOpenChange,
  inventory,
  readOnly = false,
}: InventoryFormDialogProps) {
  const { t } = useTranslation('inventory')
  const isEdit = inventory !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? t('form.viewTitle')
              : isEdit
                ? t('form.editTitle')
                : t('form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {open ? (
          <InventoryForm
            key={inventory?.id ?? 'create'}
            inventory={inventory}
            onClose={() => onOpenChange(false)}
            readOnly={readOnly}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
