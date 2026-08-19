// --- KIỂU DỮ LIỆU ĐẦU RA CHUẨN HÓA (NORMALIZED TYPES) ---

export type WarehouseLocationT = {
    id: string
    parentId: string | null
    name: string
    imageUrl: string | null
    address: string | null
    capacity: number | null
    usedCapacity: number
    childCount: number
    remainingCapacity: number | null
  }
  
  export type ActiveFondT = {
    id: string
    name: string
    dossierCount: number
  }
  
  export type ActiveFondsResponseT = {
    items: ActiveFondT[]
    total: number
  }

  export type WarehouseDashboardIntakeGranularityT = 'day' | 'month'
    
  export type WarehouseDossierChartPointT = {
    period: string
    editedCompleted: number
    fullyCompleted: number
  }
  
  export type WarehouseDossierChartT = {
    granularity: 'day' | 'month' | 'year'
    rangeStart: string
    rangeEnd: string
    points: WarehouseDossierChartPointT[]
  }
  
  export type WarehouseStatsT = {
    totalDossiers: number
    byStatus: Record<string, number>
    dossierChart: WarehouseDossierChartT
  }
  
  export type WarehouseBorrowStatsT = {
    pending: number
    approved: number
    returned: number
    rejected: number
    total: number
  }
  
  export type WarehouseDisposalCandidateT = {
    id?: string
    dossierId?: string
    name?: string
    dossierName?: string
    fondName?: string | null
  }
  
  export type WarehouseDisposalResponseT = {
    items: WarehouseDisposalCandidateT[]
    total: number
  }

  export type WarehouseUnplacedDossierT = {
    id: string
    code: string
    name: string
    fondId: string | null
    fondName: string | null
    status: string | null
    createdAt: string | null
    updatedAt: string | null
  }
  
  export type WarehouseUnplacedResponseT = {
    items: WarehouseUnplacedDossierT[]
    total: number
  }
  
  // --- KIỂU DỮ LIỆU THÔ TỪ API (RAW TYPES) ---
  
  export type WarehouseLocationRawT = {
    id?: string
    parentId?: string | null
    name?: string
    imageUrl?: string | null
    address?: string | null
    capacity?: number | null
    usedCapacity?: number
    childCount?: number
  }
  
  export type ActiveFondRawT = {
    id?: string
    fondName?: string
    dossierCount?: number
    dossiersCount?: number
  }
  
  export type ActiveFondsResponseRawT = {
    items?: ActiveFondRawT[]
    total?: number
  }

  export type WarehouseStatsT = {
    totalDossiers: number
    byStatus: Record<string, number>
    dossierChart: {
      granularity: 'day' | 'month' | 'year'
      rangeStart: string
      rangeEnd: string
      points: Array<{
        period: string
        editedCompleted: number
        fullyCompleted: number
      }>
    }
  }

  export type WarehouseUnplacedDossierRawT = {
    id?: string
    code?: string | null
    name?: string | null
    title?: string | null
    fondId?: string | null
    fondName?: string | null
    status?: string | null
    createdAt?: string | Date | null
    updatedAt?: string | Date | null
  }
  
  export type WarehouseUnplacedResponseRawT = {
    items?: WarehouseUnplacedDossierRawT[]
    total?: number
  }

