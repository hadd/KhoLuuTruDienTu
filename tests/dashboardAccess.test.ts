import { describe, expect, it } from 'vitest'
import {
  hasAnyWarehouseDashboardSection,
  isDashboardSectionVisible,
  needsAdminDashboardData,
  needsEditorDashboardData,
  needsQcDashboardData,
  resolveDashboardVariant,
} from '../src/features/permissions/lib/dashboardAccess'

describe('isDashboardSectionVisible', () => {
  it('hides section when key is in hidden even with full access', () => {
    expect(
      isDashboardSectionVisible(
        ['*'],
        ['dashboard.team.employee_kpis'],
        'dashboard.team.employee_kpis',
      ),
    ).toBe(false)
  })

  it('shows section when granted and not hidden', () => {
    expect(
      isDashboardSectionVisible(
        ['dashboard.personal.editor_summary'],
        [],
        'dashboard.personal.editor_summary',
      ),
    ).toBe(true)
  })

  it('expands legacy dashboard.editor to personal editor sections', () => {
    expect(
      isDashboardSectionVisible(
        ['dashboard.editor'],
        [],
        'dashboard.personal.editor_summary',
      ),
    ).toBe(true)
  })

  it('expands legacy dashboard.admin.summary alias', () => {
    expect(
      isDashboardSectionVisible(
        ['dashboard.admin.summary'],
        [],
        'dashboard.overview.summary',
      ),
    ).toBe(true)
  })

  it('hides with wildcard dashboard.overview.*', () => {
    expect(
      isDashboardSectionVisible(
        ['*'],
        ['dashboard.overview.*'],
        'dashboard.overview.summary',
      ),
    ).toBe(false)
  })
})

describe('modular dashboard access helpers', () => {
  it('needsEditorDashboardData for personal editor keys', () => {
    expect(
      needsEditorDashboardData(['dashboard.personal.editor_charts']),
    ).toBe(true)
  })

  it('needsQcDashboardData for personal qc keys', () => {
    expect(needsQcDashboardData(['dashboard.personal.qc_summary'])).toBe(true)
  })

  it('needsAdminDashboardData for overview keys', () => {
    expect(needsAdminDashboardData(['dashboard.overview.summary'])).toBe(true)
  })

  it('hasAnyWarehouseDashboardSection for warehouse widgets', () => {
    expect(
      hasAnyWarehouseDashboardSection([
        'dashboard.warehouse.capacity',
      ]),
    ).toBe(true)
  })

  it('legacy dashboard.warehouse grants warehouse tab sections', () => {
    expect(hasAnyWarehouseDashboardSection(['dashboard.warehouse'])).toBe(true)
  })
})

describe('resolveDashboardVariant (deprecated compatibility)', () => {
  it('returns admin when user has full access wildcard (*)', () => {
    expect(resolveDashboardVariant(['*'])).toBe('admin')
  })

  it('returns admin when user has dashboard wildcard permission (dashboard.*)', () => {
    expect(resolveDashboardVariant(['dashboard.*'])).toBe('admin')
  })

  it('returns admin when user has explicit dashboard.admin permission', () => {
    expect(resolveDashboardVariant(['dashboard.admin'])).toBe('admin')
  })

  it('returns qc when user has explicit dashboard.qc permission', () => {
    expect(resolveDashboardVariant(['dashboard.qc'])).toBe('qc')
  })

  it('returns editor when user has explicit dashboard.editor permission', () => {
    expect(resolveDashboardVariant(['dashboard.editor'])).toBe('editor')
  })

  it('returns warehouse when user has explicit dashboard.warehouse permission', () => {
    expect(resolveDashboardVariant(['dashboard.warehouse'])).toBe('warehouse')
  })

  it('returns null when user has no dashboard or data-entry permissions', () => {
    expect(resolveDashboardVariant(['projects.read'])).toBe(null)
  })
})
