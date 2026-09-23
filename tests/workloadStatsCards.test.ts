import { describe, expect, it } from 'vitest'
import type { AdminDashboardWorkloadStatsT } from '../src/features/admin-dashboard/types'

describe('WorkloadStatsCards percentage & total display', () => {
  it('correctly calculates overall file percentage relative to total for standard cards and relative to completed for error card', () => {
    const stats: AdminDashboardWorkloadStatsT = {
      total: { dossiers: 100, files: 500, pages: 1000 },
      unentered: { dossiers: 20, files: 100, pages: 200 },
      unassigned: { dossiers: 30, files: 150, pages: 300 },
      completed: { dossiers: 40, files: 200, pages: 400 },
      error: { dossiers: 10, files: 50, pages: 100 },
    }

    const calcFilePct = (files: number, refFiles: number) =>
      refFiles > 0 ? `${((files / refFiles) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%'

    expect(calcFilePct(stats.unentered.files, stats.total.files)).toBe('20%')
    expect(calcFilePct(stats.unassigned.files, stats.total.files)).toBe('30%')
    expect(calcFilePct(stats.completed.files, stats.total.files)).toBe('40%')
    // Error card is calculated relative to completed.files (50 / 200 = 25%)
    expect(calcFilePct(stats.error.files, stats.completed.files)).toBe('25%')
  })
})
