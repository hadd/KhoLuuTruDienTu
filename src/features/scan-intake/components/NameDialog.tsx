import { useEffect, useState } from 'react'
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

interface NameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  label: string
  defaultValue?: string
  onSubmit: (name: string) => void | Promise<void>
  isSubmitting?: boolean
}

export function NameDialog({
  open,
  onOpenChange,
  title,
  label,
  defaultValue = '',
  onSubmit,
  isSubmitting,
}: NameDialogProps) {
  const { t: tCommon } = useTranslation('common')
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (open) setValue(defaultValue)
  }, [open, defaultValue])

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="name-input">{label}</Label>
          <Input
            id="name-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                void onSubmit(value.trim())
              }
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('common.cancel')}
          </Button>
          <Button
            disabled={!value.trim() || isSubmitting}
            onClick={() => void onSubmit(value.trim())}
          >
            {tCommon('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
