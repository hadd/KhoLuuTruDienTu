import { useCallback, useState } from 'react'

export interface UseConfirmDialogOptions<T> {
  /** Called when user confirms; receives the pending value. Hook closes after this (and after any async work). */
  onConfirm?: (value: T) => void | Promise<void>
  /** Called when dialog is closed (Cancel or after Confirm). Use for reverting local state (e.g. input). */
  onClose?: (pendingValue: T | null) => void
}

export interface UseConfirmDialogReturn<T> {
  open: boolean
  pendingValue: T | null
  /** Open the dialog and set the value that will be passed to onConfirm when user confirms. */
  openWith: (value: T) => void
  /** Close the dialog and clear pending value. Calls onClose(pendingValue) before clearing. */
  close: () => void
  /** Call onConfirm with pendingValue then close. No-op if no pendingValue. */
  confirm: () => Promise<void>
}

export function useConfirmDialog<T>(
  options: UseConfirmDialogOptions<T> = {},
): UseConfirmDialogReturn<T> {
  const { onConfirm, onClose } = options
  const [open, setOpen] = useState(false)
  const [pendingValue, setPendingValue] = useState<T | null>(null)

  const close = useCallback(() => {
    onClose?.(pendingValue)
    setOpen(false)
    setPendingValue(null)
  }, [onClose, pendingValue])

  const openWith = useCallback((value: T) => {
    setPendingValue(value)
    setOpen(true)
  }, [])

  const confirm = useCallback(async () => {
    if (pendingValue === null) return
    await onConfirm?.(pendingValue)
    onClose?.(pendingValue)
    setOpen(false)
    setPendingValue(null)
  }, [onConfirm, onClose, pendingValue])

  return { open, pendingValue, openWith, close, confirm }
}
