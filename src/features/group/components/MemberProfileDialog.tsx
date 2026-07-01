import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import type { Member } from '../types'

interface MemberProfileDialogProps {
  open: boolean
  onOpenChange: (isOpen: boolean) => void
  member: Member | null
}

export function MemberProfileDialog({
  open,
  onOpenChange,
  member,
}: MemberProfileDialogProps) {
  if (!member) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Hồ sơ thành viên</DialogTitle>
          <DialogDescription>
            Chi tiết thông tin cá nhân của người dùng.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
          <div className="flex flex-col items-center justify-center space-y-2 mb-6">
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-lg font-semibold">{member.name}</h3>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {member.role === 'leader'
                ? 'Leader'
                : member.role === 'manager'
                  ? 'Người duyệt'
                  : 'Thành viên'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm border-t pt-4">
            <div className="font-semibold text-muted-foreground">Email:</div>
            <div className="col-span-2">{member.email}</div>

            <div className="font-semibold text-muted-foreground">
              Ngày tham gia:
            </div>
            <div className="col-span-2">{member.joinedAt}</div>

            <div className="font-semibold text-muted-foreground">ID:</div>
            <div className="col-span-2">{member.id}</div>
          </div>

          {/* Hồ sơ xử lý */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold mb-3 text-sm flex items-center justify-between">
              Các hồ sơ đã xử lý
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
                {member.documents?.length || 0} hồ sơ
              </span>
            </h4>
            <div className="space-y-3">
              {(member.documents || []).map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-2 border p-3 rounded-md bg-muted/10 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-foreground">
                        {task.id}
                      </span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {task.title}
                      </span>
                    </div>
                    {/* Hiển thị trạng thái của hồ sơ */}
                    <div className="shrink-0 flex items-center pt-0.5">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md whitespace-nowrap ${
                          // task.status === 'Hoàn thành' || task.status === 'Hoàn Thành' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          // task.status === 'Chờ duyệt' || task.status === 'Chờ Duyệt' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          // task.status === 'Biên tập' || task.status === 'Biên Tập' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' // Cho trạng thái "Duyệt" hoặc mặc định
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
