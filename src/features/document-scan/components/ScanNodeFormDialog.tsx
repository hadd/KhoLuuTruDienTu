import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { scanNodeFormSchema, type ScanNodeFormValues } from '@/features/document-scan/schemas'
import type { ScanBranchNodeType, ScanTreeNodeT } from '@/features/document-scan/types'
import {
  useCreateScanNodeMutation,
  useUpdateScanNodeMutation,
} from '@/features/document-scan/queries'
import { FormField, useAppForm } from '@/lib/forms'

interface ScanNodeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  nodeType: ScanBranchNodeType
  parentId: string | null
  node?: ScanTreeNodeT | null
  onSuccess?: (node: ScanTreeNodeT) => void
}

export function ScanNodeFormDialog({
  open,
  onOpenChange,
  mode,
  nodeType,
  parentId,
  node,
  onSuccess,
}: ScanNodeFormDialogProps) {
  const { t } = useTranslation('document-scan')
  const createNode = useCreateScanNodeMutation()
  const updateNode = useUpdateScanNodeMutation()
  const isPending = createNode.isPending || updateNode.isPending

  const defaultValues: ScanNodeFormValues = {
    name: node?.name ?? '',
  }

  const form = useAppForm({
    schema: scanNodeFormSchema,
    defaultValues,
    onSubmit: async ({ value }) => {
      if (mode === 'create') {
        const created = await createNode.mutateAsync({
          parentId,
          name: value.name,
        })
        onSuccess?.(created)
      } else if (node) {
        const updated = await updateNode.mutateAsync({
          id: node.id,
          name: value.name,
        })
        onSuccess?.(updated)
      }
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('form.createTitle', { type: t(`nodeTypes.${nodeType}`) })
              : t('form.editTitle', { type: t(`nodeTypes.${nodeType}`) })}
          </DialogTitle>
        </DialogHeader>

        <form
          key={`${mode}-${node?.id ?? parentId ?? 'root'}-${open ? 'open' : 'closed'}`}
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          <FormField form={form} name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="scan-node-name">
                  {t('form.fields.name.label')}
                </Label>
                <Input
                  id="scan-node-name"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('form.fields.name.placeholder')}
                  autoFocus
                />
                {field.state.meta.errors[0] ? (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            )}
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('form.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t('form.actions.saving')
                : mode === 'create'
                  ? t('form.actions.create')
                  : t('form.actions.update')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
