import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addMonths, differenceInDays, format, isPast } from 'date-fns'
import { Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  listSoftDeletedDossiers,
  permanentDeleteDossiers,
} from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { translateError } from '@/lib/utils/translate-error'

const AUTO_DELETE_MONTHS = 1

function getAutoDeleteInfo(deletedAt: string): {
  date: Date
  daysLeft: number
  isOverdue: boolean
} {
  const date = addMonths(new Date(deletedAt), AUTO_DELETE_MONTHS)
  const daysLeft = differenceInDays(date, new Date())
  return { date, daysLeft, isOverdue: isPast(date) }
}

export const SOFT_DELETED_DOSSIERS_QUERY_KEY = ['warehouse', 'dossiers', 'soft-deleted']

export function ArchiveSoftDeletedDossiersPage() {
  const queryClient = useQueryClient()

  const { data: dossiers = [], isPending } = useQuery({
    queryKey: SOFT_DELETED_DOSSIERS_QUERY_KEY,
    queryFn: listSoftDeletedDossiers,
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)

  const allIds = dossiers.map((d) => d.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const someSelected = selectedIds.size > 0 && !allSelected

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(allIds) : new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const permanentDeleteMutation = useMutation({
    mutationFn: () => permanentDeleteDossiers(Array.from(selectedIds)),
    onSuccess: (result) => {
      toast.success(`Đã xóa vĩnh viễn ${result.deletedIds.length} hồ sơ.`)
      setSelectedIds(new Set())
      setConfirmOpen(false)
      void queryClient.invalidateQueries({ queryKey: SOFT_DELETED_DOSSIERS_QUERY_KEY })
    },
    onError: (err) => {
      toast.error(translateError(err))
      setConfirmOpen(false)
    },
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Danh sách hồ sơ đã xóa</h2>
          <p className="text-sm text-muted-foreground">
            Các hồ sơ đã xóa mềm. Chọn và nhấn Xóa vĩnh viễn để xóa hoàn toàn khỏi hệ thống.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={selectedIds.size === 0 || permanentDeleteMutation.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {permanentDeleteMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 size-4" />
          )}
          Xóa vĩnh viễn ({selectedIds.size})
        </Button>
      </div>

      {dossiers.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          Không có hồ sơ nào đã xóa.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                    aria-label="Chọn tất cả"
                  />
                </TableHead>
                <TableHead>Tên hồ sơ</TableHead>
                <TableHead>Ngày xóa</TableHead>
                <TableHead>Xóa vĩnh viễn sau</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dossiers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(d.id)}
                      onCheckedChange={(checked) => toggleOne(d.id, checked === true)}
                      aria-label={d.name}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(d.deletedAt), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(() => {
                      const { daysLeft, isOverdue } = getAutoDeleteInfo(d.deletedAt)
                      return (
                        <span className={isOverdue ? 'font-medium text-destructive' : daysLeft <= 7 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                          {isOverdue
                            ? `Quá hạn ${Math.abs(daysLeft)} ngày`
                            : daysLeft === 0
                            ? 'Hôm nay'
                            : `Còn ${daysLeft} ngày`}
                        </span>
                      )
                    })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa vĩnh viễn</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sắp xóa vĩnh viễn <strong>{selectedIds.size} hồ sơ</strong> khỏi hệ thống và
              MinIO. Hành động này <strong>không thể hoàn tác</strong>. Bạn có chắc chắn muốn tiếp
              tục không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={permanentDeleteMutation.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => permanentDeleteMutation.mutate()}
              disabled={permanentDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {permanentDeleteMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Xóa vĩnh viễn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
