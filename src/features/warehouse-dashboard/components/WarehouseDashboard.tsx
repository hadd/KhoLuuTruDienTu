// @/features/warehouse-dashboard/components/WarehouseDashboard.tsx

import { useQuery } from '@tanstack/react-query'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight,
  FileText,
  FolderOpen,
  Loader2,
  MapPin,
  Plus,
  Share2,
  Trash2,
  TrendingUp,
  Warehouse,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { aggregateDossierStatusCategories } from '@/features/admin-dashboard/lib/dashboardStatusHelpers'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'
import { formatNumber } from '@/lib/utils/format'
import { warehouseDashboardQueries } from '../queries'

const RADIAN = Math.PI / 180

const FOND_CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#6366f1',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
  '#94a3b8',
]

// Hàm vẽ nhãn hướng ra ngoài kèm đường kẻ nối vào biểu đồ
function renderWarehouseDonutLabel(props: {
  cx?: number
  cy?: number
  midAngle?: number
  outerRadius?: number
  name?: string
  value?: number
  percent?: number
}) {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    outerRadius = 0,
    name = '',
    value = 0,
    percent = 0,
  } = props

  // Khoảng cách nhãn mở rộng ra ngoài viền biểu đồ tròn
  const radius = outerRadius + 24
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const percentString = Math.round(percent * 100)

  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="fill-foreground text-[11px] font-medium"
    >
      {`${name} ${value} (${percentString}%)`}
    </text>
  )
}

function WarehouseCard({ loc }: { loc: PhysicalWarehouseItemT }) {
  const { t } = useTranslation('warehouse-dashboard')

  // Tránh truy vấn N+1 bằng cách lấy trực tiếp chỉ số cơ bản từ prop loc
  const totalCapacity = loc.capacity ?? 0
  const usedCapacity = loc.usedCapacity ?? 0
  const fillRate = totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0
  const boxCount = loc.childCount ?? 0
  const remaining = Math.max(0, totalCapacity - usedCapacity)

  let progressColorClass = 'bg-emerald-500'
  let badgeVariantClass =
    'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400'
  let fillRateLabel = t('warehouse.status.normal')

  if (fillRate >= 90) {
    progressColorClass = 'bg-rose-500'
    badgeVariantClass =
      'bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-400'
    fillRateLabel = t('warehouse.status.veryFull')
  } else if (fillRate >= 70) {
    progressColorClass = 'bg-amber-500'
    badgeVariantClass =
      'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400'
    fillRateLabel = t('warehouse.status.quiteFull')
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-background p-3.5 shadow-2xs hover:border-primary/40 transition-colors">
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider font-mono"
          >
            {`KHO-${(loc?.id ?? '').substring(0, 4).toUpperCase()}`}
          </Badge>
            <h4 className="mt-1 font-semibold text-sm leading-tight text-foreground line-clamp-1">
              {loc.name}
            </h4>
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${badgeVariantClass}`}
          >
            {fillRateLabel} ({fillRate}%)
          </span>
        </div>

        <p className="flex items-center gap-1 text-[11px] text-muted-foreground line-clamp-1 mb-3">
          <MapPin className="size-3 shrink-0 text-muted-foreground" />
          <span>{loc.address ?? t('warehouse.card.fallbackAddress')}</span>
        </p>

        {/* Thanh Tiến độ Sức chứa */}
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t('warehouse.card.fillLabel')}</span>
            <span className="font-semibold text-foreground">{fillRate}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all ${progressColorClass}`}
              style={{ width: `${Math.min(fillRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Các con số thống kê cụ thể */}
        <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2.5">
          <div>
            <span className="text-[11px] text-muted-foreground block">
              {t('warehouse.card.usedCapacity')}
            </span>
            <span className="font-bold text-foreground">
              {formatNumber(usedCapacity)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">
              {t('warehouse.card.totalCapacity')}
            </span>
            <span className="font-bold text-foreground">
              {totalCapacity > 0 ? formatNumber(totalCapacity) : t('warehouse.card.unlimited')}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">
              {t('warehouse.card.remainingCapacity')}
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {totalCapacity > 0 ? formatNumber(remaining) : t('warehouse.card.noLimit')}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">
              {t('warehouse.card.subItems')}
            </span>
            <span className="font-semibold text-foreground">
              {formatNumber(boxCount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WarehouseDashboard() {
  const { t } = useTranslation('warehouse-dashboard')
  const navigate = useNavigate()

  // Đồng bộ trạng thái độ chia biểu đồ (day / month) trực tiếp từ URL thông qua TanStack Router
  const search = useSearch({ strict: false }) as { intakeGranularity?: 'day' | 'month' }
  const intakeGranularity = search.intakeGranularity ?? 'month'

  const handleGranularityChange = (val: 'day' | 'month') => {
    void navigate({
      search: (prev) => ({
        ...prev,
        intakeGranularity: val,
      }),
    })
  }

  // 1. SYSTEM DASHBOARD DATA FROM BACKEND API
  const { data: warehouseStats, isLoading: isLoadingStats } = useQuery(
    warehouseDashboardQueries.warehouseStats(intakeGranularity)
  )

  // 2. PHYSICAL WAREHOUSE ROOTS FROM BACKEND API
  const { data: rootLocations, isLoading: isLoadingRoots } = useQuery(
    warehouseDashboardQueries.rootLocations()
  )

  // 3. UNPLACED DOSSIERS FROM BACKEND API
  const { data: unplacedData, isLoading: isLoadingUnplaced } = useQuery(
    warehouseDashboardQueries.unplacedDossiers()
  )

  // 4. ARCHIVE BORROW REQUESTS DATA FROM BACKEND API
  const { data: borrowData, isLoading: isLoadingBorrow } = useQuery(
    warehouseDashboardQueries.borrowRequests()
  )

  // 5. FONDS DATA FROM BACKEND API
  const { data: fondsData, isLoading: isLoadingFonds } = useQuery(
    warehouseDashboardQueries.activeFonds()
  )

  // 6. DISPOSAL CANDIDATES FROM BACKEND API
  const { data: disposalData, isLoading: isLoadingDisposal } = useQuery(
    warehouseDashboardQueries.disposalCandidates()
  )

  // Sử dụng hàm helper chuẩn hóa thay vì tính toán chuỗi thủ công để tránh lỗi Logic trạng thái
  const byStatus = warehouseStats?.byStatus ?? {}
  const totalDossiers = warehouseStats?.totalDossiers ?? 0
  
  const dossierCategoryTotals = aggregateDossierStatusCategories(byStatus)
  const archivedDossiers = dossierCategoryTotals.completed
  const editedUnarchivedDossiers = dossierCategoryTotals.waitingApproval
  const uneditedUnarchivedDossiers = dossierCategoryTotals.editing + (dossierCategoryTotals.overdue ?? 0)

  // Dữ liệu biểu đồ phân bổ hình bánh
  const dossierDistributionData = [
    { name: t('warehouse.kpi.archived'), value: archivedDossiers, color: '#10b981' },
    { name: t('warehouse.kpi.editedUnarchived'), value: editedUnarchivedDossiers, color: '#3b82f6' },
    { name: t('warehouse.kpi.uneditedUnarchived'), value: uneditedUnarchivedDossiers, color: '#f59e0b' },
  ].filter((item) => item.value > 0)

  // Chỉ số mượn trả
  const borrowItems = (borrowData?.items ?? []) as BorrowRequestItemT[]
  const totalBorrows = borrowData?.total ?? borrowItems.length

  // Phân tách số lượng theo 4 trạng thái chi tiết của hệ thống mượn trả
  const pendingBorrows = borrowItems.filter((b) => b.status === 'PENDING').length
  const activeBorrows = borrowItems.filter((b) => b.status === 'APPROVED').length
  const returnedBorrows = borrowItems.filter((b) => b.status === 'EXPIRED').length
  const rejectedBorrows = borrowItems.filter((b) => b.status === 'REJECTED').length

  const totalUnplacedOverall = unplacedData?.total ?? 0

  // Chỉ số nạp kho số hóa
  const intakeChartPoints = (warehouseStats?.dossierChart?.points ?? []).map(
    (p) => ({
      date: p.period,
      count: p.editedCompleted + p.fullyCompleted,
      digitized: p.fullyCompleted,
    }),
  )

  // Dữ liệu cơ cấu theo phông
  const fondsChartItems = (fondsData?.items ?? [])
  .map((fond) => ({
    name: fond.fondName ?? fond.name ?? '-',
    value: fond.dossierCount ?? 0,
  }))
  .sort((a, b) => {
    // 1. Sắp xếp giảm dần theo số lượng hồ sơ
    if (b.value !== a.value) {
      return b.value - a.value
    }
    // 2. Nếu số lượng bằng nhau, sắp xếp tăng dần theo bảng chữ cái tiếng Việt
    return a.name.localeCompare(b.name, 'vi')
  })
  .map((item, idx) => ({
    ...item,
    // Gán màu sắc sau khi đã sắp xếp để đảm bảo dải màu hiển thị mượt mà
    color: FOND_CHART_COLORS[idx % FOND_CHART_COLORS.length],
  }))

  const disposalItems = (disposalData?.items ?? []) as DisposalCandidateItemT[]
  const totalDisposalCandidates = disposalData?.total ?? disposalItems.length

  const isGlobalLoading =
    isLoadingStats  ||
    isLoadingRoots ||
    isLoadingUnplaced ||
    isLoadingBorrow ||
    isLoadingFonds ||
    isLoadingDisposal

  return (
    <div className="w-full flex-1 min-h-0 overflow-y-auto pr-2">
      <div className="flex flex-col gap-5 pb-8 pt-1">
        {/* KHỐI 1: CHỈ SỐ KPI TỔNG QUAN HỆ THỐNG & CHO MƯỢN */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* THẺ 1: SỐ HỒ SƠ, HỒ SƠ ĐÃ LƯU KHO VÀ CHƯA LƯU KHO */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold">
                  {t('warehouse.kpi.overviewTitle')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('warehouse.kpi.overviewDesc')}
                </CardDescription>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <FileText className="size-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">

              {/* Biểu đồ phân bổ hình bánh dạng tự chỉ nhãn và kẻ hướng dẫn */}
              {totalDossiers > 0 ? (
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dossierDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                        label={renderWarehouseDonutLabel}
                        labelLine
                      >
                        {dossierDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '11px',
                        }}
                        formatter={(val: number) => [`${formatNumber(val)}`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[240px] text-center border border-dashed rounded-lg">
                  <p className="text-xs text-muted-foreground">{t('warehouse.kpi.empty')}</p>
                </div>
              )}

              {/* Các con số KPI nhỏ bên dưới */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-center">
                  <p className="text-[10px] font-medium text-emerald-800 dark:text-emerald-300 truncate">
                    {t('warehouse.kpi.archived')}
                  </p>
                  <p className="mt-0.5 text-base font-bold text-emerald-700 dark:text-emerald-400">
                    {formatNumber(archivedDossiers)}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-center">
                  <p className="text-[10px] font-medium text-blue-800 dark:text-blue-300 truncate">
                    {t('warehouse.kpi.shortEditedUnarchived')}
                  </p>
                  <p className="mt-0.5 text-base font-bold text-blue-700 dark:text-blue-400">
                    {formatNumber(editedUnarchivedDossiers)}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-center">
                  <p className="text-[10px] font-medium text-amber-800 dark:text-amber-300 truncate">
                    {t('warehouse.kpi.shortUneditedUnarchived')}
                  </p>
                  <p className="mt-0.5 text-base font-bold text-amber-700 dark:text-amber-400">
                    {formatNumber(uneditedUnarchivedDossiers)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* THẺ 2: SỐ HỒ SƠ CHO MƯỢN */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold">
                  {t('warehouse.kpi.borrowTitle', 'Thống Kê Mượn & Tra Cứu Hồ Sơ')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('warehouse.kpi.borrowDesc', 'Số lượng yêu cầu mượn khai thác đọc số Online trên hệ thống')}
                </CardDescription>
              </div>
              <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
                <Share2 className="size-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex items-baseline justify-between border-b pb-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('warehouse.kpi.totalBorrows', 'Tổng số yêu cầu mượn trên hệ thống')}
                  </p>
                  <p className="text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                    {formatNumber(totalBorrows)}
                  </p>
                </div>
              </div>

              {/* Lưới hiển thị chi tiết 4 trạng thái mượn trả */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* 1. Chưa duyệt */}
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    {t('warehouse.kpi.pendingBorrows', 'Chưa duyệt')}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {formatNumber(pendingBorrows)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t('warehouse.kpi.pendingBorrowsDesc', 'Yêu cầu chờ phê duyệt')}
                  </p>
                </div>

                {/* 2. Số Đang Mượn */}
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                  <p className="text-xs font-medium text-purple-800 dark:text-purple-300">
                    {t('warehouse.kpi.activeBorrows', 'Số Đang Mượn')}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatNumber(activeBorrows)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t('warehouse.kpi.activeBorrowsDesc', 'Đang trong thời hạn mượn')}
                  </p>
                </div>

                {/* 3. Đã hoàn trả */}
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    {t('warehouse.kpi.returnedBorrows', 'Đã hoàn trả')}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatNumber(returnedBorrows)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t('warehouse.kpi.returnedBorrowsDesc', 'Hồ sơ đã được trả về kho')}
                  </p>
                </div>

                {/* 4. Bị từ chối */}
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                  <p className="text-xs font-medium text-rose-800 dark:text-rose-300">
                    {t('warehouse.kpi.rejectedBorrows', 'Bị từ chối')}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
                    {formatNumber(rejectedBorrows)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t('warehouse.kpi.rejectedBorrowsDesc', 'Yêu cầu mượn bị bác bỏ')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* KHỐI 2: SỨC CHỨA TÁCH RIÊNG CHO TỪNG KHO */}
        <section>
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    {t('warehouse.capacity.title')}
                  </CardTitle>
                  <Badge variant="outline" className="font-normal text-xs">
                    {t('warehouse.capacity.countBadge', { count: rootLocations?.length ?? 0 })}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {rootLocations && rootLocations.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {rootLocations.map((loc) => (
                    <WarehouseCard key={loc.id} loc={loc} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg border-dashed">
                  <Warehouse className="size-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-semibold text-foreground">
                    {t('warehouse.capacity.emptyTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('warehouse.capacity.emptyDesc')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* KHỐI 3: BIỂU ĐỒ TĂNG TRƯỜNG NẠP KHO SỐ & HỒ SƠ CHƯA PHÂN VỊ TRÍ */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* BỂU ĐỒ TĂNG TRƯỜNG NẠP KHO SỐ */}
          <Card className="border-border bg-card shadow-xs lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold">
                  {t('warehouse.chart.intakeTitle')}
                </CardTitle>
              </div>
              <Tabs
                value={intakeGranularity}
                onValueChange={(val) => handleGranularityChange(val as 'day' | 'month')}
                className="w-auto"
              >
                <TabsList className="h-8 p-0.5 text-xs">
                  <TabsTrigger value="day" className="h-7 text-xs px-2.5">
                    {t('warehouse.chart.tabs.day')}
                  </TabsTrigger>
                  <TabsTrigger value="month" className="h-7 text-xs px-2.5">
                    {t('warehouse.chart.tabs.month')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pt-2">
              {intakeChartPoints.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={intakeChartPoints}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorDigitized" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name={t('warehouse.chart.intakeLabel')}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorCount)"
                      />
                      <Area
                        type="monotone"
                        dataKey="digitized"
                        name={t('warehouse.chart.digitizedLabel')}
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorDigitized)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[280px] text-center border rounded-lg border-dashed">
                  <TrendingUp className="size-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {t('warehouse.chart.empty')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SỐ HỒ SƠ CHƯA PHÂN VỊ TRÍ */}
          <Card className="border-border bg-card shadow-xs flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  {t('warehouse.unplaced.title')}
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="font-semibold text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400"
                >
                  {t('warehouse.unplaced.countBadge', { count: totalUnplacedOverall })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pt-1">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs py-2 px-2 font-semibold">
                        {t('warehouse.unplaced.table.colName')}
                      </TableHead>
                      <TableHead className="text-xs py-2 px-2 font-semibold">
                        {t('warehouse.unplaced.table.colUpdate')}
                      </TableHead>
                      <TableHead className="text-xs py-2 px-2 text-right font-semibold">
                        {t('warehouse.unplaced.table.colActions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unplacedData?.items && unplacedData.items.length > 0 ? (
                      unplacedData.items.map((dos) => (
                        <TableRow key={dos?.id ?? ''} className="text-xs">
                          <TableCell className="py-2 px-2 max-w-[140px] truncate">
                            <div className="font-medium truncate">{dos?.name ?? '-'}</div>
                            <div className="text-[10px] text-muted-foreground truncate font-mono">
                              {dos?.id ? dos.id.substring(0, 8).toUpperCase() : '-'}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-2 text-muted-foreground text-[11px]">
                            {dos.updatedAt
                              ? new Date(dos.updatedAt).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell className="py-2 px-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2 text-primary"
                            >
                              <Plus className="size-3 mr-1" />
                              {t('warehouse.unplaced.table.actionAssign')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-xs text-muted-foreground py-6"
                        >
                          {t('warehouse.unplaced.table.empty')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* KHỐI 4: PHÂN BỐ THEO PHÔNG & HỒ SƠ ĐẾN HẠN TIÊU HỦY */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* PHÂN BỐ HỒ SƠ THEO PHÔNG LƯU TRỮ */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {t('warehouse.fonds.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('warehouse.fonds.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {fondsChartItems.length > 0 ? (
                <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                  <div className="h-[230px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={fondsChartItems}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {fondsChartItems.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            borderColor: '#334155',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                          formatter={(val: number) => [`${formatNumber(val)}`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 text-xs">
                    {fondsChartItems.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate text-foreground font-medium">{item.name}</span>
                        </div>
                        <span className="font-bold text-muted-foreground ml-2">
                          {formatNumber(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[230px] text-center border rounded-lg border-dashed">
                  <FolderOpen className="size-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {t('warehouse.fonds.empty')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DANH MỤC HỒ SƠ ĐẾN HẠN TIÊU HỦY */}
          <Card className="border-border bg-card shadow-xs flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  {t('warehouse.disposal.title')}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10"
                >
                  <Trash2 className="size-3 mr-1" />
                  {t('warehouse.disposal.countBadge', { count: totalDisposalCandidates })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pt-1">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs py-2 px-2 font-semibold">
                        {t('warehouse.unplaced.table.colName')}
                      </TableHead>
                      <TableHead className="text-xs py-2 px-2 font-semibold">
                        {t('warehouse.disposal.table.colFond')}
                      </TableHead>
                      <TableHead className="text-xs py-2 px-2 text-right font-semibold">
                        {t('warehouse.disposal.table.colStatus')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disposalItems.length > 0 ? (
                      disposalItems.map((exp) => (
                        // Sử dụng dossierId làm key dự phòng nếu id trống
                        <TableRow key={exp?.id ?? exp?.dossierId ?? ''} className="text-xs">
                          <TableCell 
                            className="py-2.5 px-2 max-w-[160px]" 
                            // Sử dụng dossierName làm tooltip dự phòng
                            title={exp?.title ?? exp?.name ?? exp?.dossierName}
                          >
                            {/* Lấy dossierName nếu title hoặc name không tồn tại */}
                            <div className="font-medium truncate">
                              {exp?.title ?? exp?.name ?? exp?.dossierName ?? '-'}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {/* Sử dụng dossierId cắt chuỗi làm mã hồ sơ dự phòng nếu trường code bị trống */}
                              {exp?.code ?? (
                                (exp?.id ?? exp?.dossierId) 
                                  ? (exp?.id ?? exp?.dossierId)!.substring(0, 8).toUpperCase() 
                                  : '-'
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 px-2 text-muted-foreground">
                            {exp?.fondName ?? t('warehouse.disposal.table.fallbackFond')}
                          </TableCell>
                          <TableCell className="py-2.5 px-2 text-right">
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400"
                            >
                              {t('warehouse.disposal.table.statusPending')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-xs text-muted-foreground py-6"
                        >
                          {t('warehouse.disposal.table.empty')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}