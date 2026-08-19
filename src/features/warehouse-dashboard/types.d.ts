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
  
  // --- KIỂU DỮ LIỆU THÔ TỪ API (RAW TYPES) ---
  
  type WarehouseLocationRawT = {
    id?: string
    parentId?: string | null
    name?: string
    imageUrl?: string | null
    address?: string | null
    capacity?: number | null
    usedCapacity?: number
    childCount?: number
  }
  
  type ActiveFondRawT = {
    id?: string
    fondName?: string
    dossierCount?: number
    dossiersCount?: number
  }
  
  type ActiveFondsResponseRawT = {
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

