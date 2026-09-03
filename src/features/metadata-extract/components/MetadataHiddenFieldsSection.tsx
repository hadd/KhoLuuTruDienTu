import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff, Plus, Trash2, Edit2, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  metadataHiddenFieldsQueryOptions,
  useCreateMetadataHiddenFieldMutation,
  useDeleteMetadataHiddenFieldMutation,
  useUpdateMetadataHiddenFieldMutation,
} from '@/features/metadata-extract/queries'
import type { MetadataHiddenFieldItemT } from '@/features/metadata-extract/api/metadataHiddenFieldClient'

export function MetadataHiddenFieldsSection() {
  const { data: fields = [], isLoading } = useQuery(metadataHiddenFieldsQueryOptions())
  const createMutation = useCreateMetadataHiddenFieldMutation()
  const updateMutation = useUpdateMetadataHiddenFieldMutation()
  const deleteMutation = useDeleteMetadataHiddenFieldMutation()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MetadataHiddenFieldItemT | null>(null)
  const [fieldCode, setFieldCode] = useState('')
  const [description, setDescription] = useState('')
  const [isHidden, setIsHidden] = useState(true)

  const openAddDialog = () => {
    setEditingItem(null)
    setFieldCode('')
    setDescription('')
    setIsHidden(true)
    setDialogOpen(true)
  }

  const openEditDialog = (item: MetadataHiddenFieldItemT) => {
    setEditingItem(item)
    setFieldCode(item.fieldCode)
    setDescription(item.description ?? '')
    setIsHidden(item.isHidden)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!fieldCode.trim()) return

    if (editingItem) {
      await updateMutation.mutateAsync({
        id: editingItem.id,
        input: {
          fieldCode: fieldCode.trim(),
          description: description.trim() || null,
          isHidden,
        },
      })
    } else {
      await createMutation.mutateAsync({
        fieldCode: fieldCode.trim(),
        description: description.trim() || null,
        isHidden,
      })
    }
    setDialogOpen(false)
  }

  const handleToggle = (item: MetadataHiddenFieldItemT, checked: boolean) => {
    updateMutation.mutate({
      id: item.id,
      input: {
        isHidden: checked,
      },
    })
  }

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa cấu hình trường ẩn này?')) {
      deleteMutation.mutate(id)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <EyeOff className="size-5 text-primary" />
            Cấu hình Ẩn / Hiển thị trường Metadata
          </CardTitle>

          <CardDescription className="mt-1 text-sm text-muted-foreground">
            Thêm các mã trường metadata để ẩn hoặc hiện ở màn hình quản lý dữ liệu.
          </CardDescription>
        </div>

        <Button onClick={openAddDialog} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Thêm trường ẩn
        </Button>
      </CardHeader>

      <CardContent>
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Quy tắc hoạt động:</p>
            <p>
              • <strong>Công tắc BẬT</strong>: Trường tương ứng (ví dụ: <code className="rounded bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 font-mono">MA_HO_SO</code>) sẽ <strong>bị ẩn</strong> không hiển thị ở màn quản lý dữ liệu.<br />
              • <strong>Công tắc TẮT</strong>: Trường vẫn sẽ được <strong>hiển thị</strong> ra bình thường.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : fields.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
            <p>Chưa có trường metadata ẩn nào được cấu hình.</p>
            <Button onClick={openAddDialog} variant="link" size="sm" className="mt-1">
              + Thêm trường ngay
            </Button>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[200px] font-semibold">Mã trường (Field Code)</TableHead>
                  <TableHead className="font-semibold">Tên / Mô tả</TableHead>
                  <TableHead className="w-[220px] font-semibold">Trạng thái Ẩn/Hiện</TableHead>
                  <TableHead className="w-[100px] text-right font-semibold">Thao tác</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {fields.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-medium text-foreground">
                      {item.fieldCode}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {item.description || '—'}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={item.isHidden}
                          onCheckedChange={(checked) => handleToggle(item, checked)}
                          disabled={updateMutation.isPending}
                        />

                        {item.isHidden ? (
                          <Badge variant="destructive" className="gap-1 font-normal text-xs">
                            <EyeOff className="size-3" />
                            Bật (Đang Ẩn)
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 font-normal text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <Eye className="size-3" />
                            Tắt (Hiển thị)
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEditDialog(item)}
                          title="Sửa cấu hình"
                        >
                          <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(item.id)}
                          title="Xóa cấu hình"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Sửa cấu hình trường ẩn' : 'Thêm trường ẩn Metadata'}
            </DialogTitle>
            <DialogDescription>
              Nhập mã trường metadata cần điều chỉnh ẩn/hiện ở màn quản lý dữ liệu.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fieldCode" className="font-medium">
                Mã trường <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fieldCode"
                placeholder="VD: MA_HO_SO, TINH_TRANG_VAT_LY"
                value={fieldCode}
                onChange={(e) => setFieldCode(e.target.value.toUpperCase())}
                className="font-mono uppercase"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="font-medium">
                Tên / Mô tả trường
              </Label>
              <Input
                id="description"
                placeholder="VD: Mã hồ sơ"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Ẩn hiển thị ở màn Quản lý dữ liệu</Label>
                <p className="text-xs text-muted-foreground">
                  {isHidden ? 'Đang BẬT -> Trường sẽ bị ẨN' : 'Đang TẮT -> Trường vẫn HIỂN THỊ'}
                </p>
              </div>

              <Switch checked={isHidden} onCheckedChange={setIsHidden} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={!fieldCode.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Lưu cấu hình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
