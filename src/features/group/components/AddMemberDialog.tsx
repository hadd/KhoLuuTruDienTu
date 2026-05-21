import React, { useState } from 'react'
import { useTranslation } from 'react-i18next' 

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAddMember } from '../queries'
import type { Group,AddMemberDialogProps } from '../types'




export function AddMemberDialog({ open, onOpenChange, group }: AddMemberDialogProps) {
  const { mutate: addMember, isPending } = useAddMember()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'leader' | 'manager' | 'member'>('member')

  // Hàm xử lý reset form sạch sẽ
  const handleResetForm = () => {
    setName('')
    setEmail('')
    setRole('member')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!group) return

    addMember(
      {
        groupId: group.id,
        member: { name, email, role , documents: []},
      },
      {
        onSuccess: () => {
          handleResetForm()
          onOpenChange(false) // Đóng dialog thông qua prop chuẩn của Shadcn
        },
      }
    )
  }

  return (
    // 2. Sử dụng trực tiếp open và onOpenChange từ props truyền xuống
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) handleResetForm() // Reset form nếu người dùng bấm ra ngoài hoặc nhấn ESC để đóng
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thêm thành viên</DialogTitle>
          <DialogDescription>
            Thêm tài khoản vào nhóm <span className="font-semibold text-foreground">{group?.name}</span>. Bấm lưu để hoàn tất.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Họ và tên</Label>
            <Input
              id="name"
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="nguyenvana@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Vai trò</Label>
            <Select 
              value={role} 
              onValueChange={(v: 'leader' | 'manager' | 'member') => setRole(v)}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Thành viên</SelectItem>
                <SelectItem value="manager">Người duyệt</SelectItem>
                <SelectItem value="leader">Leader</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
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
              {isPending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}