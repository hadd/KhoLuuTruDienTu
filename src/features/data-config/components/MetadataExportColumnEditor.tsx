import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  EXPORT_SEPARATOR_OPTIONS,
  fieldCatalogToGroups,
  fieldLabel,
  isFieldAssignedToOtherColumn,
  moveColumn,
  moveFieldInColumn,
  toggleFieldAcrossColumns,
  toggleFieldInColumn,
  type MetadataExportColumnErrors,
} from '@/features/data-config/lib/metadataExportHelpers'
import type {
  MetadataExportColumnConfigT,
  MetadataExportFieldCatalogItemT,
} from '@/features/data-config/types'
import { cn } from '@/lib/utils/cn'

interface MetadataExportColumnEditorProps {
  columns: Array<MetadataExportColumnConfigT>
  fieldCatalog: Array<MetadataExportFieldCatalogItemT>
  disabled?: boolean
  columnErrors?: MetadataExportColumnErrors
  onChange: (columns: Array<MetadataExportColumnConfigT>) => void
}

interface ColumnPositionInputProps {
  column: MetadataExportColumnConfigT
  currentIndex: number
  totalColumns: number
  disabled?: boolean
  onMove: (targetIndex: number) => void
}

function ColumnPositionInput({
  column,
  currentIndex,
  totalColumns,
  disabled,
  onMove,
}: ColumnPositionInputProps) {
  const [value, setValue] = useState((currentIndex + 1).toString())

  useEffect(() => {
    setValue((currentIndex + 1).toString())
  }, [currentIndex, column])

  const handleCommit = () => {
    const targetPos = parseInt(value, 10)
    if (isNaN(targetPos) || targetPos < 1 || targetPos > totalColumns) {
      setValue((currentIndex + 1).toString())
      return
    }
    const targetIndex = targetPos - 1
    if (targetIndex !== currentIndex) {
      onMove(targetIndex)
    }
  }

  return (
    <Input
      type="number"
      min={1}
      max={totalColumns}
      disabled={disabled}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleCommit()
        }
      }}
      className="h-8 w-12 p-1 text-center font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  )
}

export function MetadataExportColumnEditor({
  columns,
  fieldCatalog,
  disabled = false,
  columnErrors = {},
  onChange,
}: MetadataExportColumnEditorProps) {
  const { t } = useTranslation('data-config')
  const groups = fieldCatalogToGroups(fieldCatalog)

  // Quản lý cột đang được chọn để cấu hình chi tiết ở bảng bên phải
  const [activeColumnIndex, setActiveColumnIndex] = useState<number | null>(
    columns.length > 0 ? 0 : null,
  )

  // Đồng bộ index khi danh sách cột thay đổi bên ngoài
  useEffect(() => {
    if (columns.length === 0) {
      setActiveColumnIndex(null)
    } else if (activeColumnIndex === null || activeColumnIndex >= columns.length) {
      setActiveColumnIndex(0)
    }
  }, [columns.length, activeColumnIndex])

  // Bản đồ ánh xạ từ field key sang tên nhóm (groupName)
  const fieldKeyToGroupName = useMemo(() => {
    const map = new Map<string, string>()
    groups.forEach((group) => {
      group.fields.forEach((field) => {
        map.set(field.key, group.groupName)
      })
    })
    return map
  }, [groups])

  // Đếm số lần xuất hiện của các nhãn hiển thị để phát hiện trùng lặp
  const displayCount = useMemo(() => {
    const map = new Map<string, number>()
    fieldCatalog.forEach((item) => {
      const label = fieldLabel(fieldCatalog, item.key)
      if (label) {
        map.set(label, (map.get(label) || 0) + 1)
      }
    })
    return map
  }, [fieldCatalog])

  // Hàm lấy nhãn thông minh (đính kèm nhóm nếu trùng lặp)
  const getFieldSmartLabel = (fieldKey: string) => {
    const baseLabel = fieldLabel(fieldCatalog, fieldKey) || fieldKey
    const count = displayCount.get(baseLabel) || 0
    if (count > 1) {
      const groupName = fieldKeyToGroupName.get(fieldKey)
      if (groupName) {
        return `${baseLabel} (${groupName})`
      }
    }
    return baseLabel
  }

  // Hàm lấy danh sách nhóm của cột
  const getColumnGroupsString = (col: MetadataExportColumnConfigT) => {
    const names = col.fieldKeys
      .map((key) => fieldKeyToGroupName.get(key))
      .filter(Boolean) as string[]
    const uniqueNames = Array.from(new Set(names))
    if (uniqueNames.length === 0) return ''
    return ` (${uniqueNames.join(', ')})`
  }

  const assignedKeys = new Set(columns.flatMap((col) => col.fieldKeys))
  const unselectedFields = fieldCatalog.filter((field) => !assignedKeys.has(field.key))
  const hasUnselectedFields = unselectedFields.length > 0

  const handleConvertUnselectedToColumns = () => {
    if (!hasUnselectedFields) return

    const newCols: Array<MetadataExportColumnConfigT> = unselectedFields.map((field) => ({
      header: getFieldSmartLabel(field.key),
      fieldKeys: [field.key],
      separator: ', ',
    }))

    const nextCols = [...columns, ...newCols]
    onChange(nextCols)
    // Tự động chọn cột mới sinh ra đầu tiên để người dùng dễ theo dõi
    setActiveColumnIndex(columns.length)
  }

  const handleAddColumn = () => {
    const nextCols: Array<MetadataExportColumnConfigT> = [
      ...columns,
      { header: '', fieldKeys: [], separator: ', ' },
    ]
    onChange(nextCols)
    // Chọn cột mới vừa được thêm
    setActiveColumnIndex(nextCols.length - 1)
  }

  const updateColumn = (
    index: number,
    patch: Partial<MetadataExportColumnConfigT>,
  ) => {
    onChange(
      columns.map((column, columnIndex) =>
        columnIndex === index ? { ...column, ...patch } : column,
      ),
    )
  }

  const removeColumn = (index: number) => {
    const nextCols = columns.filter((_, columnIndex) => columnIndex !== index)
    onChange(nextCols)

    // Cập nhật lại chỉ số cột đang hoạt động khi xóa
    if (nextCols.length === 0) {
      setActiveColumnIndex(null)
    } else if (activeColumnIndex === index) {
      setActiveColumnIndex(Math.max(0, index - 1))
    } else if (activeColumnIndex !== null && activeColumnIndex > index) {
      setActiveColumnIndex(activeColumnIndex - 1)
    }
  }

  const activeColumn = activeColumnIndex !== null ? columns[activeColumnIndex] : null

  return (
    <div className="flex flex-col gap-4">
      {/* Thanh công cụ phía trên */}
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <p className="text-sm font-medium">{t('metadataExport.columnsTitle')}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !hasUnselectedFields}
            onClick={handleConvertUnselectedToColumns}
          >
            <Plus className="size-4" aria-hidden />
            {t('metadataExport.addUnselectedAsColumns', 'Chuyển trường chưa chọn thành cột')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={handleAddColumn}
          >
            <Plus className="size-4" aria-hidden />
            {t('metadataExport.addColumn')}
          </Button>
        </div>
      </div>

      {/* Bố cục 2 cột (Trái: Danh sách cột | Phải: Bộ cấu hình trường chi tiết) */}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] items-start">
        
        {/* CỘT BÊN TRÁI: Danh sách cấu hình cột rút gọn */}
        <div className="space-y-3 min-h-0">
          {columns.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center border rounded-lg border-dashed">
              {t('metadataExport.emptyColumns')}
            </p>
          ) : (
            columns.map((column, columnIndex) => {
              const errors = columnErrors[columnIndex]
              const isSelected = columnIndex === activeColumnIndex

              return (
                <div
                  key={`column-${columnIndex}`}
                  onClick={() => setActiveColumnIndex(columnIndex)}
                  className={cn(
                    'rounded-lg border bg-card p-4 transition-all cursor-pointer hover:border-muted-foreground/30',
                    isSelected
                      ? 'ring-2 ring-primary border-transparent shadow-sm'
                      : errors
                        ? 'border-destructive'
                        : 'border-border',
                  )}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {t('metadataExport.columnNumber', { number: columnIndex + 1 })}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        {getColumnGroupsString(column)}
                      </span>
                    </p>
                    
                    {/* Ngăn chặn sự kiện nổi bọt để tránh click nút bấm làm kích hoạt lại việc chọn thẻ */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled || columnIndex === 0}
                        onClick={() =>
                          onChange(moveColumn(columns, columnIndex, columnIndex - 1))
                        }
                        aria-label={t('metadataExport.moveColumnUp')}
                      >
                        <ChevronUp className="size-4" />
                      </Button>

                      <ColumnPositionInput
                        column={column}
                        currentIndex={columnIndex}
                        totalColumns={columns.length}
                        disabled={disabled}
                        onMove={(targetIndex) =>
                          onChange(moveColumn(columns, columnIndex, targetIndex))
                        }
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled || columnIndex === columns.length - 1}
                        onClick={() =>
                          onChange(moveColumn(columns, columnIndex, columnIndex + 1))
                        }
                        aria-label={t('metadataExport.moveColumnDown')}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        onClick={() => removeColumn(columnIndex)}
                        aria-label={t('metadataExport.removeColumn')}
                      >
                        <Trash2 className="size-4 text-destructive hover:text-destructive hover:bg-destructive/10" />
                      </Button>
                    </div>
                  </div>

                  {/* Bố cục thích ứng: Tự động tràn toàn màn hình nếu chỉ có 1 trường trở xuống (không hiện dấu ngăn cách) */}
                  <div
                    className={cn(
                      'grid gap-3',
                      column.fieldKeys.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1',
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('metadataExport.headerLabel')}</Label>
                      <Input
                        data-export-column-header
                        value={column.header}
                        disabled={disabled}
                        placeholder={t('metadataExport.headerPlaceholder')}
                        aria-invalid={Boolean(errors?.missingHeader || errors?.duplicateHeader)}
                        className={cn(
                          'h-9 text-sm',
                          (errors?.missingHeader || errors?.duplicateHeader) &&
                            'border-destructive',
                        )}
                        onChange={(event) =>
                          updateColumn(columnIndex, { header: event.target.value })
                        }
                      />
                      {errors?.missingHeader ? (
                        <p className="text-xs text-destructive">
                          {t('metadataExport.validation.missingHeaderInline')}
                        </p>
                      ) : null}
                      {errors?.duplicateHeader ? (
                        <p className="text-xs text-destructive">
                          {t('metadataExport.validation.duplicateHeaderInline')}
                        </p>
                      ) : null}
                    </div>

                    {/* Chỉ hiện cấu hình dấu ngăn cách khi cột có từ 2 trường trở lên */}
                    {column.fieldKeys.length > 1 ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('metadataExport.separatorLabel')}</Label>
                        <Select
                          value={column.separator}
                          disabled={disabled}
                          onValueChange={(value) =>
                            updateColumn(columnIndex, { separator: value })
                          }
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPORT_SEPARATOR_OPTIONS.map((option) => (
                              <SelectItem key={option.labelKey} value={option.value}>
                                {t(`metadataExport.separators.${option.labelKey}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>

                  {/* Hiển thị danh sách các trường trong cột dưới dạng các tag nhỏ gọn */}
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground block mb-1">
                      {t('metadataExport.fieldsLabel')}
                    </Label>
                    {column.fieldKeys.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {column.fieldKeys.map((fieldKey) => (
                          <span
                            key={fieldKey}
                            className="inline-flex items-center gap-1 rounded bg-muted border px-2 py-0.5 text-xs font-medium text-foreground"
                          >
                            {getFieldSmartLabel(fieldKey)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        {t('metadataExport.noFieldsInColumn')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* CỘT BÊN PHẢI: Bảng cấu hình trường chi tiết (Cố định khi cuộn trang) */}
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4 lg:sticky lg:top-4 shadow-sm">
          {!activeColumn ? (
            <div className="py-8 text-center text-sm text-muted-foreground italic">
              Vui lòng chọn hoặc thêm một cột ở danh sách bên trái để cấu hình chi tiết các trường dữ liệu.
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-semibold text-primary">
                  Chi tiết: {t('metadataExport.columnNumber', { number: activeColumnIndex + 1 })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeColumn.header || 'Chưa đặt tiêu đề cột'}
                </p>
              </div>

              {/* Danh sách sắp xếp & gỡ bỏ các trường đã gán vào cột hiện tại */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Trường đã gán vào cột
                </Label>
                {activeColumn.fieldKeys.length > 0 ? (
                  <ul className="space-y-1 rounded-md border border-border p-2 bg-background max-h-[160px] overflow-y-auto">
                    {activeColumn.fieldKeys.map((fieldKey, fieldIndex) => (
                      <li
                        key={fieldKey}
                        className="flex items-center justify-between gap-2 text-xs py-0.5 border-b last:border-0 border-border/50"
                      >
                        <span className="truncate font-medium">
                          {getFieldSmartLabel(fieldKey)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={disabled || fieldIndex === 0}
                            onClick={() =>
                              updateColumn(
                                activeColumnIndex!,
                                moveFieldInColumn(activeColumn, fieldIndex, fieldIndex - 1),
                              )
                            }
                            aria-label={t('metadataExport.moveFieldUp')}
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={
                              disabled || fieldIndex === activeColumn.fieldKeys.length - 1
                            }
                            onClick={() =>
                              updateColumn(
                                activeColumnIndex!,
                                moveFieldInColumn(activeColumn, fieldIndex, fieldIndex + 1),
                              )
                            }
                            aria-label={t('metadataExport.moveFieldDown')}
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={disabled}
                            onClick={() =>
                              updateColumn(
                                activeColumnIndex!,
                                toggleFieldInColumn(activeColumn, fieldKey, false),
                              )
                            }
                            aria-label={t('metadataExport.removeField')}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic bg-background p-3 rounded-md border border-border border-dashed text-center">
                    Cột này hiện chưa chọn trường nào.
                  </p>
                )}
              </div>

              {/* Danh sách catalog tất cả các trường dữ liệu phân loại theo nhóm */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Lựa chọn trường để gán vào cột
                </Label>
                <div className="max-h-[280px] space-y-3 overflow-y-auto rounded-md border border-border p-3 bg-background">
                  {groups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t('metadataExport.noFieldCatalog')}
                    </p>
                  ) : (
                    groups.map((group) => (
                      <div key={group.groupCode}>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 border-b pb-0.5">
                          {group.groupName}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {group.fields.map((field) => {
                            const checked = activeColumn.fieldKeys.includes(field.key)
                            const assignedElsewhere = isFieldAssignedToOtherColumn(
                              columns,
                              activeColumnIndex!,
                              field.key,
                            )
                            const isDisabled = disabled || (assignedElsewhere && !checked)

                            return (
                              <button
                                key={field.key}
                                type="button"
                                disabled={isDisabled}
                                title={
                                  assignedElsewhere && !checked
                                    ? t('metadataExport.fieldAssignedElsewhere')
                                    : undefined
                                }
                                onClick={() =>
                                  onChange(
                                    toggleFieldAcrossColumns(
                                      columns,
                                      activeColumnIndex!,
                                      field.key,
                                      !checked,
                                    ),
                                  )
                                }
                                className={cn(
                                  'rounded border px-2 py-0.5 text-[11px] transition-colors',
                                  checked
                                    ? 'border-primary bg-primary/10 text-primary font-medium'
                                    : assignedElsewhere
                                      ? 'cursor-not-allowed border-border bg-muted/40 text-muted-foreground opacity-50'
                                      : 'border-border bg-background hover:bg-muted/50',
                                )}
                              >
                                {field.display}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}