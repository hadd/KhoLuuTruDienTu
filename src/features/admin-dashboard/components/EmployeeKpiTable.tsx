import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  RotateCcw,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { adminGroupsQueryOptions } from '@/features/group/queries'
import { adminRolesQueryOptions } from '@/features/user/queries'
import { formatNumber } from '@/lib/utils/format'

import { exportEmployeeKpiToExcel } from '../lib/exportKpiExcel'
import type { AdminDashboardEmployeeKpiT, AdminDashboardGroupStatsT } from '../types'
import { formatPercentValue } from './AdminDashboardPage'

const dashboardRouteApi = getRouteApi('/app/dashboard/')

export type EmployeeKpiTableProps = {
  data: Array<AdminDashboardEmployeeKpiT>
  selectedGroupId?: string
  dashboardGroups?: Array<AdminDashboardGroupStatsT>
  onDateRangeChange?: (dateFrom?: string, dateTo?: string) => void
}

export function EmployeeKpiTable({
  data,
  selectedGroupId,
  dashboardGroups = [],
  onDateRangeChange,
}: EmployeeKpiTableProps) {
  const { t } = useTranslation('admin-dashboard')
  const navigate = dashboardRouteApi.useNavigate()

  // 1. Tải danh sách nhóm & vai trò hệ thống từ API
  const { data: adminGroupsData } = useQuery(
    adminGroupsQueryOptions({ limit: 100 }),
  )
  const { data: systemRoles = [] } = useQuery(adminRolesQueryOptions())

  // Tổng hợp danh sách tổ/nhóm duy nhất thực tế có trong danh sách nhân sự KPI
  const combinedGroups = useMemo(() => {
    const map = new Map<string, string>()

    data.forEach((item) => {
      const totalAssigned = (item.assignedDossiersCount ?? 0) + (item.makerAssignedDossiersCount ?? 0) + (item.qcAssignedDossiersCount ?? 0)
      if (item.role !== 'admin' && totalAssigned > 0) {
        if (item.groupId && item.groupName) {
          map.set(item.groupId, item.groupName)
        } else if (item.groupName) {
          map.set(item.groupName, item.groupName)
        }
      }
    })

    if (map.size === 0) {
      dashboardGroups.forEach((g) => {
        if (g.id || g.name) {
          map.set(g.id ?? g.name, g.name)
        }
      })
    }

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [dashboardGroups, data])

  // Danh sách các vai trò thực tế xuất hiện trong danh sách nhân sự KPI
  const availableRoles = useMemo(() => {
    const roleMap = new Map<string, string>()

    data.forEach((item) => {
      const totalAssigned = (item.assignedDossiersCount ?? 0) + (item.makerAssignedDossiersCount ?? 0) + (item.qcAssignedDossiersCount ?? 0)
      if (item.role !== 'admin' && totalAssigned > 0) {
        const roleKey = item.role.toLowerCase()
        if (roleKey === 'editor' || roleKey.includes('biên tập') || roleKey.includes('maker')) {
          roleMap.set('editor', 'Biên tập (Editor)')
        } else if (roleKey === 'qc' || roleKey.startsWith('qc') || roleKey.includes('kiểm duyệt') || roleKey.includes('checker')) {
          roleMap.set('qc', 'Kiểm duyệt (QC)')
        } else {
          const sysRole = systemRoles.find((r) => r.id.toLowerCase() === roleKey || r.name.toLowerCase() === roleKey)
          roleMap.set(item.role, sysRole ? sysRole.name : item.role)
        }
      }
    })

    return Array.from(roleMap.entries()).map(([id, name]) => ({ id, name }))
  }, [data, systemRoles])

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>(selectedGroupId || 'all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [period, setPeriod] = useState<string>('30d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Đồng bộ groupFilter nếu query parameter URL selectedGroupId thay đổi
  useEffect(() => {
    if (selectedGroupId !== undefined && selectedGroupId !== groupFilter) {
      setGroupFilter(selectedGroupId || 'all')
    }
  }, [selectedGroupId])

  const handleGroupChange = (val: string) => {
    setGroupFilter(val)
    setCurrentPage(1)
    void (navigate as (opts: any) => Promise<void>)({
      search: (prev: any) => ({
        ...prev,
        groupId: val === 'all' ? undefined : val,
      }),
    })
  }

  const handlePeriodChange = (newPeriod: string, customFrom?: string, customTo?: string) => {
    setPeriod(newPeriod)
    setCurrentPage(1)

    let dFrom = ''
    let dTo = ''

    const today = new Date()
    const formatDateStr = (d: Date) => d.toISOString().split('T')[0]

    if (newPeriod === 'today') {
      dFrom = formatDateStr(today)
      dTo = formatDateStr(today)
    } else if (newPeriod === '7d') {
      const past = new Date(today)
      past.setDate(past.getDate() - 7)
      dFrom = formatDateStr(past)
      dTo = formatDateStr(today)
    } else if (newPeriod === '30d') {
      const past = new Date(today)
      past.setDate(past.getDate() - 30)
      dFrom = formatDateStr(past)
      dTo = formatDateStr(today)
    } else if (newPeriod === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      dFrom = formatDateStr(startOfMonth)
      dTo = formatDateStr(today)
    } else if (newPeriod === 'custom') {
      dFrom = customFrom !== undefined ? customFrom : dateFrom
      dTo = customTo !== undefined ? customTo : dateTo
    }

    if (newPeriod !== 'custom') {
      setDateFrom(dFrom)
      setDateTo(dTo)
      onDateRangeChange?.(dFrom, dTo)
    } else {
      if (customFrom !== undefined) setDateFrom(customFrom)
      if (customTo !== undefined) setDateTo(customTo)
      if (dFrom || dTo) {
        onDateRangeChange?.(dFrom || undefined, dTo || undefined)
      }
    }
  }

  // Sorting & Pagination States
  const [sortBy, setSortBy] = useState<
    'fullName' | 'groupName' | 'dossier' | 'page' | 'time' | 'rejected' | 'accuracy'
  >('accuracy')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  // Filter Data
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // 0. Ẩn Admin tổng & nhân sự chưa được giao hồ sơ nào
      const totalAssigned = (item.assignedDossiersCount ?? 0) + (item.makerAssignedDossiersCount ?? 0) + (item.qcAssignedDossiersCount ?? 0)
      if (item.role === 'admin' || totalAssigned <= 0) {
        return false
      }

      // 1. Search Query Filter
      const matchSearch =
        item.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (item.groupName ?? '').toLowerCase().includes(searchQuery.toLowerCase().trim())

      if (!matchSearch) return false

      // 2. Group Filter
      if (groupFilter !== 'all') {
        const selectedGroup = combinedGroups.find((g) => g.id === groupFilter)
        const targetName = selectedGroup ? selectedGroup.name.toLowerCase() : groupFilter.toLowerCase()
        const matchesGroup =
          (Boolean(item.groupId) && item.groupId === groupFilter) ||
          (item.groupName ?? '').toLowerCase() === targetName ||
          (item.groupName ?? '').toLowerCase().includes(targetName)

        if (!matchesGroup) return false
      }

      // 3. Role Filter (Dynamic System Roles & Keyword fallbacks)
      if (roleFilter !== 'all') {
        const matchedRoleObj = systemRoles.find((r) => r.id === roleFilter)
        const itemRoleLower = item.role.toLowerCase()
        const filterLower = roleFilter.toLowerCase()

        const matchesRole =
          itemRoleLower === filterLower ||
          (filterLower === 'editor' && (itemRoleLower === 'editor' || itemRoleLower.includes('biên tập') || itemRoleLower.includes('maker'))) ||
          (filterLower === 'qc' && (itemRoleLower === 'qc' || itemRoleLower.startsWith('qc') || itemRoleLower.includes('kiểm duyệt') || itemRoleLower.includes('checker'))) ||
          (filterLower === 'admin' && (itemRoleLower === 'admin' || itemRoleLower.includes('quản trị'))) ||
          (matchedRoleObj && (
            itemRoleLower === matchedRoleObj.id.toLowerCase() ||
            itemRoleLower === matchedRoleObj.name.toLowerCase()
          ))

        if (!matchesRole) return false
      }

      // 4. KPI Status Filter (Visual Badges)
      if (statusFilter !== 'all') {
        if (statusFilter === 'EXCELLENT' && item.accuracyRate < 95) return false
        if (
          statusFilter === 'GOOD' &&
          (item.accuracyRate < 80 || item.accuracyRate >= 95)
        )
          return false
        if (statusFilter === 'WARNING' && item.accuracyRate >= 80) return false
      }

      return true
    })
  }, [data, searchQuery, groupFilter, combinedGroups, roleFilter, systemRoles, statusFilter])

  // Sort Data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA: number | string = 0
      let valB: number | string = 0

      if (sortBy === 'fullName') {
        valA = a.fullName.toLowerCase()
        valB = b.fullName.toLowerCase()
      } else if (sortBy === 'groupName') {
        valA = (a.groupName ?? '').toLowerCase()
        valB = (b.groupName ?? '').toLowerCase()
      } else if (sortBy === 'dossier') {
        valA = a.completedDossiersCount
        valB = b.completedDossiersCount
      } else if (sortBy === 'page') {
        valA = a.completedPagesCount
        valB = b.completedPagesCount
      } else if (sortBy === 'time') {
        valA = a.avgProcessingTimeMinutes ?? 0
        valB = b.avgProcessingTimeMinutes ?? 0
      } else if (sortBy === 'rejected') {
        valA = a.rejectedDossiersCount ?? 0
        valB = b.rejectedDossiersCount ?? 0
      } else if (sortBy === 'accuracy') {
        valA = a.accuracyRate
        valB = b.accuracyRate
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA)
      }

      return sortOrder === 'asc'
        ? Number(valA) - Number(valB)
        : Number(valB) - Number(valA)
    })
  }, [filteredData, sortBy, sortOrder])

  // Pagination Math
  const totalItems = sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, safePage, pageSize])

  const handleSort = (
    field: 'fullName' | 'groupName' | 'dossier' | 'page' | 'time' | 'rejected' | 'accuracy',
  ) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  // Handle Export Excel
  const handleExportExcel = async () => {
    try {
      setIsExporting(true)
      const selectedGroupObj = combinedGroups.find((g) => g.id === groupFilter)
      const selectedRoleObj = systemRoles.find((r) => r.id === roleFilter)

      await exportEmployeeKpiToExcel(sortedData, {
        groupName: selectedGroupObj ? selectedGroupObj.name : groupFilter === 'all' ? 'Tất cả' : groupFilter,
        roleName: selectedRoleObj ? selectedRoleObj.name : roleFilter === 'all' ? 'Tất cả' : roleFilter,
        searchQuery: searchQuery || undefined,
        statusFilter: statusFilter === 'all' ? 'Tất cả' : statusFilter,
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Get localized role name
  const getRoleLabel = (roleKey: string) => {
    const foundSystemRole = systemRoles.find(
      (r) => r.id === roleKey || r.name.toLowerCase() === roleKey.toLowerCase(),
    )
    if (foundSystemRole) {
      return foundSystemRole.name
    }
    return t(`roles.${roleKey}`, { defaultValue: roleKey })
  }

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalUsers = data.length

    // Chỉ tính Độ chính xác TB cho các nhân sự đã có hồ sơ hoàn thành hoặc có lượt kiểm tra/đánh giá
    const activeAccuracyUsers = data.filter(
      (item) => item.completedDossiersCount > 0 || (item.rejectedDossiersCount ?? 0) > 0,
    )
    const avgAccuracy =
      activeAccuracyUsers.length > 0
        ? Math.round(
            (activeAccuracyUsers.reduce((sum, item) => sum + item.accuracyRate, 0) /
              activeAccuracyUsers.length) *
              10,
          ) / 10
        : totalUsers > 0
        ? Math.round(
            (data.reduce((sum, item) => sum + item.accuracyRate, 0) / totalUsers) * 10,
          ) / 10
        : 0

    const totalRejected = data.reduce(
      (sum, item) => sum + (item.rejectedDossiersCount ?? 0),
      0,
    )

    // Chỉ tính Thời gian TB cho các nhân sự đã hoàn thành hồ sơ và có thời gian xử lý > 0
    const activeTimeUsers = data.filter(
      (item) => item.completedDossiersCount > 0 && (item.avgProcessingTimeMinutes ?? 0) > 0,
    )
    const avgTime =
      activeTimeUsers.length > 0
        ? Math.round(
            activeTimeUsers.reduce(
              (sum, item) => sum + (item.avgProcessingTimeMinutes ?? 0),
              0,
            ) / activeTimeUsers.length,
          )
        : 0

    return { totalUsers, avgAccuracy, totalRejected, avgTime }
  }, [data])

  const fromItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const toItem = Math.min(safePage * pageSize, totalItems)

  // Badge Color Helper based on Accuracy Rate
  const getAccuracyBadgeStyle = (accuracyRate: number) => {
    if (accuracyRate >= 95) {
      return {
        variant: 'outline' as const,
        className:
          'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
        label: 'Xuất sắc',
      }
    }
    if (accuracyRate >= 80) {
      return {
        variant: 'outline' as const,
        className:
          'bg-amber-50 text-amber-700 border-amber-300 font-semibold dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
        label: 'Đạt',
      }
    }
    return {
      variant: 'outline' as const,
      className:
        'bg-rose-50 text-rose-700 border-rose-300 font-semibold dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
      label: 'Cần cải thiện',
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-4 border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              {t('employeeKpi.title', { defaultValue: 'Bảng Đánh Giá KPI Nhân Sự' })}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {t('employeeKpi.description', {
                defaultValue: 'Thống kê chi tiết tiến độ, số trang xử lý và tỷ lệ chính xác theo nhân sự',
              })}
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isExporting || totalItems === 0}
            className="h-8 gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950 font-medium"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
          </Button>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-card text-card-foreground shadow-xs">
            <div className="p-2 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Users className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Tổng nhân sự</p>
              <p className="text-sm font-bold">{summaryMetrics.totalUsers}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-card text-card-foreground shadow-xs">
            <div className="p-2 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Độ chính xác TB</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {formatPercentValue(summaryMetrics.avgAccuracy, 1)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-card text-card-foreground shadow-xs">
            <div className="p-2 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <RotateCcw className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Lượt bị trả về</p>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {summaryMetrics.totalRejected}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-card text-card-foreground shadow-xs">
            <div className="p-2 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Clock className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Thời gian TB/hồ sơ</p>
              <p className="text-sm font-bold">{summaryMetrics.avgTime} phút</p>
            </div>
          </div>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
            {/* Search Input */}
            <div className="relative w-[180px]">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('employeeKpi.searchPlaceholder', { defaultValue: 'Tìm theo tên hoặc tổ nhóm...' })}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Group Filter */}
            <Select
              value={groupFilter}
              onValueChange={handleGroupChange}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="Tổ / Nhóm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả tổ nhóm</SelectItem>
                {combinedGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Role Filter (System Roles) */}
            <Select
              value={roleFilter}
              onValueChange={(val) => {
                setRoleFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả vai trò</SelectItem>
                {availableRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* KPI Status Visual Filter */}
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Đánh giá KPI" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả mức KPI</SelectItem>
                <SelectItem value="EXCELLENT">🟢 Xuất sắc (≥95%)</SelectItem>
                <SelectItem value="GOOD">🟡 Đạt (80-94%)</SelectItem>
                <SelectItem value="WARNING">🔴 Cần cải thiện (&lt;80%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Period Filter */}
          <div className="flex items-center gap-2">
            <Select
              value={period}
              onValueChange={(val) => handlePeriodChange(val)}
            >
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t('employeeKpi.period.today', { defaultValue: 'Hôm nay' })}</SelectItem>
                <SelectItem value="7d">{t('employeeKpi.period.7d', { defaultValue: '7 ngày qua' })}</SelectItem>
                <SelectItem value="30d">{t('employeeKpi.period.30d', { defaultValue: '30 ngày qua' })}</SelectItem>
                <SelectItem value="month">{t('employeeKpi.period.month', { defaultValue: 'Tháng này' })}</SelectItem>
                <SelectItem value="custom">{t('employeeKpi.period.custom', { defaultValue: 'Tùy chỉnh' })}</SelectItem>
              </SelectContent>
            </Select>

            {period === 'custom' ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handlePeriodChange('custom', e.target.value, dateTo)}
                  className="h-8 w-[120px] text-xs"
                />
                <span className="text-xs text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => handlePeriodChange('custom', dateFrom, e.target.value)}
                  className="h-8 w-[120px] text-xs"
                />
              </div>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            {/* Header Row 1: Group Columns */}
            <TableRow className="hover:bg-transparent border-b bg-muted/40">
              <TableHead rowSpan={2} className="w-[200px] align-middle">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('fullName')}
                  className="-ml-3 h-8 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <span>{t('employeeKpi.columns.employee', { defaultValue: 'Nhân sự' })}</span>
                  <ArrowUpDown className="ml-1.5 size-3" />
                </Button>
              </TableHead>

              <TableHead rowSpan={2} className="w-[130px] align-middle">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('groupName')}
                  className="-ml-3 h-8 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <span>Tổ / Nhóm</span>
                  <ArrowUpDown className="ml-1.5 size-3" />
                </Button>
              </TableHead>

              {/* Group Column 1: Hồ Sơ Biên Tập */}
              <TableHead colSpan={2} className="text-center font-bold border-l border-r bg-blue-50/60 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200 py-1.5">
                Hồ Sơ Biên Tập
              </TableHead>

              {/* Group Column 2: Hồ Sơ Duyệt */}
              <TableHead colSpan={2} className="text-center font-bold border-r bg-indigo-50/60 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 py-1.5">
                Hồ Sơ Duyệt
              </TableHead>

              <TableHead rowSpan={2} className="text-center align-middle">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('time')}
                  className="h-8 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <span>Thời gian TB</span>
                  <ArrowUpDown className="ml-1.5 size-3" />
                </Button>
              </TableHead>

              <TableHead rowSpan={2} className="text-center align-middle">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('rejected')}
                  className="h-8 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <span>Bị trả về</span>
                  <ArrowUpDown className="ml-1.5 size-3" />
                </Button>
              </TableHead>

              <TableHead rowSpan={2} className="text-right align-middle">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('accuracy')}
                  className="-mr-3 h-8 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <span>{t('employeeKpi.columns.accuracyRate', { defaultValue: 'Độ chính xác KPI' })}</span>
                  <ArrowUpDown className="ml-1.5 size-3" />
                </Button>
              </TableHead>
            </TableRow>

            {/* Header Row 2: Sub Columns */}
            <TableRow className="hover:bg-transparent border-b bg-muted/20">
              {/* Editor Sub Columns */}
              <TableHead className="text-center border-l border-r text-xs font-medium py-1.5 w-[145px]">
                <Button variant="ghost" size="sm" onClick={() => handleSort('dossier')} className="h-7 text-xs p-1 font-semibold">
                  <span>Số hồ sơ</span>
                  <ArrowUpDown className="ml-1 size-2.5" />
                </Button>
              </TableHead>
              <TableHead className="text-center border-r text-xs font-medium py-1.5 w-[145px]">
                <Button variant="ghost" size="sm" onClick={() => handleSort('page')} className="h-7 text-xs p-1 font-semibold">
                  <span>Số trang</span>
                  <ArrowUpDown className="ml-1 size-2.5" />
                </Button>
              </TableHead>

              {/* QC Sub Columns */}
              <TableHead className="text-center border-r text-xs font-semibold py-1.5 w-[145px]">
                Số hồ sơ
              </TableHead>
              <TableHead className="text-center border-r text-xs font-semibold py-1.5 w-[145px]">
                Số trang
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row) => {
                const badgeStyle = getAccuracyBadgeStyle(row.accuracyRate)

                // Editor Values
                const makerCompletedDossiers = row.makerCompletedDossiersCount ?? (row.role === 'editor' ? row.completedDossiersCount : 0)
                const makerAssignedDossiers = row.makerAssignedDossiersCount ?? (row.role === 'editor' ? row.assignedDossiersCount : 0)
                const makerDossierRate = row.makerDossierCompletionRate ?? (row.role === 'editor' ? row.dossierCompletionRate : 0)

                const makerCompletedPages = row.makerCompletedPagesCount ?? (row.role === 'editor' ? row.completedPagesCount : 0)
                const makerAssignedPages = row.makerAssignedPagesCount ?? (row.role === 'editor' ? row.assignedPagesCount : 0)
                const makerPageRate = row.makerPageCompletionRate ?? (row.role === 'editor' ? row.pageCompletionRate : 0)

                // QC Values
                const qcCompletedDossiers = row.qcCompletedDossiersCount ?? (row.role === 'qc' ? row.completedDossiersCount : 0)
                const qcAssignedDossiers = row.qcAssignedDossiersCount ?? (row.role === 'qc' ? row.assignedDossiersCount : 0)
                const qcDossierRate = row.qcDossierCompletionRate ?? (row.role === 'qc' ? row.dossierCompletionRate : 0)

                const qcCompletedPages = row.qcCompletedPagesCount ?? (row.role === 'qc' ? row.completedPagesCount : 0)
                const qcAssignedPages = row.qcAssignedPagesCount ?? (row.role === 'qc' ? row.assignedPagesCount : 0)
                const qcPageRate = row.qcPageCompletionRate ?? (row.role === 'qc' ? row.pageCompletionRate : 0)

                return (
                  <TableRow key={row.userId} className="hover:bg-muted/50">
                    {/* 1. Nhân sự & Role */}
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {row.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-foreground truncate">
                            {row.fullName}
                          </span>
                          <Badge
                            variant="secondary"
                            className="w-fit text-[9px] px-1 py-0 font-normal uppercase"
                          >
                            {getRoleLabel(row.role)}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>

                    {/* 2. Tổ / Nhóm */}
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-medium">
                        {row.groupName ?? 'Chưa gán nhóm'}
                      </span>
                    </TableCell>

                    {/* 3. Hồ Sơ Biên Tập - Số hồ sơ */}
                    <TableCell className="border-l border-r">
                      <div className="flex flex-col gap-1 w-[135px] mx-auto">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {formatNumber(makerCompletedDossiers, { maximumFractionDigits: 0 })} / {formatNumber(makerAssignedDossiers, { maximumFractionDigits: 0 })} HS
                          </span>
                          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                            {formatPercentValue(makerDossierRate, 1)}
                          </span>
                        </div>
                        <Progress value={Math.min(100, makerDossierRate)} className="h-1.5" />
                      </div>
                    </TableCell>

                    {/* 4. Hồ Sơ Biên Tập - Số trang */}
                    <TableCell className="border-r">
                      <div className="flex flex-col gap-1 w-[135px] mx-auto">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {formatNumber(makerCompletedPages, { maximumFractionDigits: 0 })} / {formatNumber(makerAssignedPages, { maximumFractionDigits: 0 })} tr
                          </span>
                          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                            {formatPercentValue(makerPageRate, 1)}
                          </span>
                        </div>
                        <Progress value={Math.min(100, makerPageRate)} className="h-1.5 bg-muted" />
                      </div>
                    </TableCell>

                    {/* 5. Hồ Sơ Duyệt - Số hồ sơ */}
                    <TableCell className="border-r bg-muted/10">
                      <div className="flex flex-col gap-1 w-[135px] mx-auto">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {formatNumber(qcCompletedDossiers, { maximumFractionDigits: 0 })} / {formatNumber(qcAssignedDossiers, { maximumFractionDigits: 0 })} HS
                          </span>
                          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                            {formatPercentValue(qcDossierRate, 1)}
                          </span>
                        </div>
                        <Progress value={Math.min(100, qcDossierRate)} className="h-1.5" />
                      </div>
                    </TableCell>

                    {/* 6. Hồ Sơ Duyệt - Số trang */}
                    <TableCell className="border-r bg-muted/10">
                      <div className="flex flex-col gap-1 w-[135px] mx-auto">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {formatNumber(qcCompletedPages, { maximumFractionDigits: 0 })} / {formatNumber(qcAssignedPages, { maximumFractionDigits: 0 })} tr
                          </span>
                          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                            {formatPercentValue(qcPageRate, 1)}
                          </span>
                        </div>
                        <Progress value={Math.min(100, qcPageRate)} className="h-1.5 bg-muted" />
                      </div>
                    </TableCell>

                    {/* 7. Thời gian xử lý TB */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground font-medium">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>{row.avgProcessingTimeMinutes ?? 0} phút</span>
                      </div>
                    </TableCell>

                    {/* 8. Số lượt bị trả về */}
                    <TableCell className="text-center">
                      {(row.rejectedDossiersCount ?? 0) > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-[11px] px-2 py-0.5 bg-rose-50 text-rose-700 border-rose-200 font-semibold dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                        >
                          {row.rejectedDossiersCount} lượt
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>

                    {/* 9. Độ chính xác KPI Visual Badge */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Badge variant={badgeStyle.variant} className={`text-xs px-2 py-0.5 ${badgeStyle.className}`}>
                          {formatPercentValue(row.accuracyRate, 1)}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-xs text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <AlertTriangle className="size-5 text-muted-foreground/60" />
                    <span>Không tìm thấy dữ liệu KPI nhân sự phù hợp</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        {totalItems > 0 ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-3 mt-3">
            <div className="text-xs text-muted-foreground">
              Hiển thị <span className="font-medium">{fromItem}</span> - <span className="font-medium">{toItem}</span> trong tổng số <span className="font-medium">{totalItems}</span> nhân sự
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Số dòng/trang:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-7 w-[65px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage <= 1}
                  className="h-7 px-2 text-xs"
                >
                  Trang trước
                </Button>
                <span className="text-xs text-muted-foreground px-1">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage >= totalPages}
                  className="h-7 px-2 text-xs"
                >
                  Trang sau
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
