import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

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

import type { Group } from '../types'

interface GroupSetupDialogProps {
  open: boolean
  onOpenChange: (isOpen: boolean) => void
  group: Group | null
}

export function GroupSetupDialog({
  open,
  onOpenChange,
  group,
}: GroupSetupDialogProps) {
  const [memberLimit, setMemberLimit] = useState('')
  const [taskLimit, setTaskLimit] = useState('')

  useEffect(() => {
    if (group && open) {
      // Mock setting existing values
      setMemberLimit('50')
      setTaskLimit('200')
    }
  }, [group, open])

  if (!group) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    // Xử lý lưu thiết lập ở đây (mock logic)
    toast.success(`Đã lưu cấu hình cho nhóm ${group.name}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cấu hình nhóm (Setup)</DialogTitle>
          <DialogDescription>
            Thiết lập quản lý thành viên và hồ sơ cho nhóm{' '}
            <span className="font-semibold text-foreground">{group.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="memberLimit">Giới hạn số lượng thành viên</Label>
            <Input
              id="memberLimit"
              type="number"
              value={memberLimit}
              onChange={(e) => setMemberLimit(e.target.value)}
              placeholder="VD: 50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taskLimit">Số lượng hồ sơ giao (tối đa)</Label>
            <Input
              id="taskLimit"
              type="number"
              value={taskLimit}
              onChange={(e) => setTaskLimit(e.target.value)}
              placeholder="VD: 5"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit">Lưu thiết lập</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
