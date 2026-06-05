import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { UserT } from '@/features/auth/types'
import { adminUsersByRoleQueryOptions } from '@/features/user/queries'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { useCreateGroup } from '../queries'

const EDITOR_ROLE_ID = 'editor'
const QC_ROLE_ID = 'qc'

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (isOpen: boolean) => void
}

interface UserMultiSelectFieldProps {
  label: string
  placeholder: string
  selectedLabel: string
  emptyLabel: string
  loadingLabel: string
  users: Array<UserT>
  isLoading: boolean
  selectedIds: Array<string>
  onToggle: (userId: string) => void
  disabled?: boolean
}

function UserMultiSelectField({
  label,
  placeholder,
  selectedLabel,
  emptyLabel,
  loadingLabel,
  users,
  isLoading,
  selectedIds,
  onToggle,
  disabled,
}: UserMultiSelectFieldProps) {
  const userById = (id: string) => users.find((u) => u.id === id)

  return (
    <div className="flex flex-col space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal hover:bg-background text-left min-h-10 h-auto py-2"
            disabled={disabled || isLoading}
          >
            <div className="flex flex-wrap gap-1 max-w-[90%]">
              {isLoading ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadingLabel}
                </span>
              ) : selectedIds.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selectedIds.map((id) => {
                  const user = userById(id)
                  if (!user) return null
                  return (
                    <Badge key={id} variant="secondary" className="font-normal">
                      {user.fullName}
                    </Badge>
                  )
                })
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="max-h-60 overflow-y-auto p-1 space-y-1">
            {isLoading ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">{loadingLabel}</p>
            ) : users.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              users.map((user) => {
                const isSelected = selectedIds.includes(user.id)
                return (
                  <button
                    key={user.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors text-left hover:bg-muted',
                      isSelected && 'bg-muted/60',
                    )}
                    onClick={() => onToggle(user.id)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{user.fullName}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center border rounded-sm border-primary transition-all',
                        isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50',
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selectedIds.length > 0 && (
        <p className="text-sm text-muted-foreground">{selectedLabel}</p>
      )}
    </div>
  )
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const { t } = useTranslation('group')
  const { mutate: createGroup, isPending } = useCreateGroup()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [roundNumber, setRoundNumber] = useState<number | string>('')
  const [selectedEditorIds, setSelectedEditorIds] = useState<Array<string>>([])
  const [selectedQcIds, setSelectedQcIds] = useState<Array<string>>([])

  const { data: editorsData, isLoading: isLoadingEditors } = useQuery({
    ...adminUsersByRoleQueryOptions(EDITOR_ROLE_ID),
    enabled: open,
  })

  const { data: qcData, isLoading: isLoadingQc } = useQuery({
    ...adminUsersByRoleQueryOptions(QC_ROLE_ID),
    enabled: open,
  })

  const editors = editorsData?.items ?? []
  const qcUsers = qcData?.items ?? []

  const handleResetForm = () => {
    setName('')
    setDescription('')
    setRoundNumber('')
    setSelectedEditorIds([])
    setSelectedQcIds([])
  }

  const handleToggleEditor = (userId: string) => {
    setSelectedEditorIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const handleToggleQc = (userId: string) => {
    setSelectedQcIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const parsedRound = Number(roundNumber)
    if (!Number.isFinite(parsedRound) || parsedRound < 1) {
      toast.error(t('createDialog.validation.roundNumberRequired'))
      return
    }
    if (selectedEditorIds.length === 0) {
      toast.error(t('createDialog.validation.editorsRequired'))
      return
    }
    if (selectedQcIds.length === 0) {
      toast.error(t('createDialog.validation.qcRequired'))
      return
    }

    createGroup(
      {
        name: name.trim(),
        description: description.trim(),
        roundNumber: parsedRound,
        editorIds: selectedEditorIds,
        qcIds: selectedQcIds,
      },
      {
        onSuccess: () => {
          handleResetForm()
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) handleResetForm()
      }}
    >
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="create-group-name">{t('createDialog.fields.name.label')}</Label>
            <Input
              id="create-group-name"
              placeholder={t('createDialog.fields.name.placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-group-desc">{t('createDialog.fields.description.label')}</Label>
            <Input
              id="create-group-desc"
              placeholder={t('createDialog.fields.description.placeholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-group-round">{t('createDialog.fields.roundNumber.label')}</Label>
            <Input
              id="create-group-round"
              type="number"
              placeholder={t('createDialog.fields.roundNumber.placeholder')}
              value={roundNumber}
              onChange={(e) => setRoundNumber(e.target.value)}
              min={1}
              required
              disabled={isPending}
            />
          </div>

          <UserMultiSelectField
            label={t('createDialog.fields.editors.label')}
            placeholder={t('createDialog.fields.editors.placeholder')}
            selectedLabel={t('createDialog.fields.editors.selected', {
              count: selectedEditorIds.length,
            })}
            emptyLabel={t('createDialog.fields.editors.empty')}
            loadingLabel={t('createDialog.fields.editors.loading')}
            users={editors}
            isLoading={isLoadingEditors}
            selectedIds={selectedEditorIds}
            onToggle={handleToggleEditor}
            disabled={isPending}
          />

          <UserMultiSelectField
            label={t('createDialog.fields.qc.label')}
            placeholder={t('createDialog.fields.qc.placeholder')}
            selectedLabel={t('createDialog.fields.qc.selected', { count: selectedQcIds.length })}
            emptyLabel={t('createDialog.fields.qc.empty')}
            loadingLabel={t('createDialog.fields.qc.loading')}
            users={qcUsers}
            isLoading={isLoadingQc}
            selectedIds={selectedQcIds}
            onToggle={handleToggleQc}
            disabled={isPending}
          />

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                handleResetForm()
              }}
              disabled={isPending}
            >
              {t('createDialog.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('createDialog.actions.submitting') : t('createDialog.actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
