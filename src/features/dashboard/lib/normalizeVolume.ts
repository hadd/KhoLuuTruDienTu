export type DashboardWorkloadVolumeT = {
  dossiers: number
  files: number
  pages: number
}

const EMPTY_VOLUME: DashboardWorkloadVolumeT = {
  dossiers: 0,
  files: 0,
  pages: 0,
}

export function normalizeVolume(value: unknown): DashboardWorkloadVolumeT {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { dossiers: value, files: 0, pages: 0 }
  }

  if (value && typeof value === 'object') {
    const rec = value as Partial<DashboardWorkloadVolumeT>
    return {
      dossiers: rec.dossiers ?? 0,
      files: rec.files ?? 0,
      pages: rec.pages ?? 0,
    }
  }

  return { ...EMPTY_VOLUME }
}
