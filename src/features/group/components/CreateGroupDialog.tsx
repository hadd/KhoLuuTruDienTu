import React, { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { useCreateGroup } from '../queries' 

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (isOpen: boolean) => void
}

// Mock data danh sách tài khoản hệ thống (Bạn có thể thay thế bằng useQuery lấy data admin/user thực tế)
const SYSTEM_USERS = [
  { id: 'u1', name: 'Nguyễn Văn A', email: 'admin.a@example.com' },
  { id: 'u2', name: 'Trần Thị B', email: 'admin.b@example.com' },
  { id: 'u3', name: 'Phạm Văn C', email: 'admin.c@example.com' },
]

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const { mutate: createGroup, isPending } = useCreateGroup()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [totalReviewersLimit, setTotalReviewersLimit] = useState<number | string>('')
  const [selectedAdminIds, setSelectedAdminIds] = useState<Array<string>>([])
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<Array<string>>([])

  const handleResetForm = () => {
    setName('')
    setDescription('')
    setTotalReviewersLimit('')
    setSelectedAdminIds([])
    setSelectedReviewerIds([])
  }

  const handleToggleAdmin = (userId: string) => {
    setSelectedAdminIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  const handleToggleReviewer = (userId: string) => {
    setSelectedReviewerIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId)
      } else {
        if (prev.length >= 3) {
          toast.error('Chỉ được chọn tối đa 3 Quản lý (Người duyệt).')
          return prev
        }
        return [...prev, userId]
      }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    createGroup(
      {
        name,
        description,
        adminIds: selectedAdminIds,
        reviewerIds: selectedReviewerIds,
      },
      {
        onSuccess: () => {
          handleResetForm()
          onOpenChange(false)
        },
      }
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
          <DialogTitle>Tạo nhóm mới</DialogTitle>
          <DialogDescription>
            Tạo nhóm làm việc mới và chỉ định một hoặc nhiều tài khoản làm quản trị viên điều hành.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Input Tên nhóm */}
          <div className="space-y-2">
            <Label htmlFor="create-group-name">Tên nhóm</Label>
            <Input
              id="create-group-name"
              placeholder="Nhập tên nhóm..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          {/* Input Mô tả */}
          <div className="space-y-2">
            <Label htmlFor="create-group-desc">Mô tả</Label>
            <Input
              id="create-group-desc"
              placeholder="Nhập mô tả ngắn cho nhóm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Input Tổng số người duyệt */}
          <div className="space-y-2">
            <Label htmlFor="total-reviewers-limit">Tổng số người duyệt (Ví dụ: Leader + Người duyệt)</Label>
            <Input
              id="total-reviewers-limit"
              type="number"
              placeholder="Nhập tổng số người duyệt..."
              value={totalReviewersLimit}
              onChange={(e) => setTotalReviewersLimit(e.target.value)}
              min={1}
              disabled={isPending}
            />
          </div>

          {/* Ô chọn nhiều Quản trị viên */}
          <div className="space-y-2 flex flex-col">
            <Label>Gán Leader (Đã chọn {selectedAdminIds.length})</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal hover:bg-background text-left min-h-10 h-auto py-2"
                  disabled={isPending}
                >
                  <div className="flex flex-wrap gap-1 max-w-[90%]">
                    {selectedAdminIds.length === 0 ? (
                      <span className="text-muted-foreground">Chọn danh sách Leader...</span>
                    ) : (
                      selectedAdminIds.map((id) => {
                        const user = SYSTEM_USERS.find((u) => u.id === id)
                        if (!user) return null
                        return (
                          <Badge key={user.id} variant="secondary" className="font-normal">
                            Leader: {user.name}
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
                  {SYSTEM_USERS.map((user) => {
                    const isSelected = selectedAdminIds.includes(user.id)
                    return (
                      <button
                        key={user.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors text-left hover:bg-muted",
                          isSelected && "bg-muted/60"
                        )}
                        onClick={() => handleToggleAdmin(user.id)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                        <div className={cn(
                          "flex h-4 w-4 items-center justify-center border rounded-sm border-primary transition-all",
                          isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                        )}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Ô chọn nhiều Người duyệt */}
          <div className="space-y-2 flex flex-col">
            <Label>Gán Quản lý (Người duyệt) - Đã chọn {selectedReviewerIds.length}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal hover:bg-background text-left min-h-10 h-auto py-2"
                  disabled={isPending}
                >
                  <div className="flex flex-wrap gap-1 max-w-[90%]">
                    {selectedReviewerIds.length === 0 ? (
                      <span className="text-muted-foreground">Chọn danh sách Quản lý...</span>
                    ) : (
                      selectedReviewerIds.map((id, index) => {
                        const user = SYSTEM_USERS.find((u) => u.id === id)
                        if (!user) return null
                        return (
                          <Badge key={user.id} variant="secondary" className="font-normal bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-100">
                            Duyệt {index + 1}: {user.name}
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
                  {SYSTEM_USERS.map((user) => {
                    const isSelected = selectedReviewerIds.includes(user.id)
                    return (
                      <button
                        key={user.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors text-left hover:bg-muted",
                          isSelected && "bg-muted/60"
                        )}
                        onClick={() => handleToggleReviewer(user.id)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                        <div className={cn(
                          "flex h-4 w-4 items-center justify-center border rounded-sm border-primary transition-all",
                          isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                        )}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
            <div className="text-sm text-muted-foreground mt-1">
              * Tổng số người duyệt hiện tại (Leader + Người duyệt): <span className="font-semibold text-foreground">{selectedAdminIds.length + selectedReviewerIds.length}</span>
              {totalReviewersLimit && Number(totalReviewersLimit) > 0 && (
                <span className="font-semibold text-foreground"> / {totalReviewersLimit}</span>
              )}
            </div>
          </div>

          {/* Footer nút bấm */}
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
              Hủy
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Đang tạo...' : 'Tạo mới'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}