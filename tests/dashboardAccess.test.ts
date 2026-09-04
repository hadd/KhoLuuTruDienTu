import { describe, expect, it } from 'vitest'
import { resolveDashboardVariant } from '../src/features/permissions/lib/dashboardAccess'

describe('resolveDashboardVariant', () => {
  it('returns admin when user has full access wildcard (*)', () => {
    expect(resolveDashboardVariant(['*'])).toBe('admin')
  })

  it('returns admin when user has dashboard wildcard permission (dashboard.*)', () => {
    expect(resolveDashboardVariant(['dashboard.*'])).toBe('admin')
  })

  it('returns admin when user has explicit dashboard.admin permission', () => {
    expect(resolveDashboardVariant(['dashboard.admin'])).toBe('admin')
  })

  it('returns admin when user has dashboard.admin.unassigned permission', () => {
    expect(resolveDashboardVariant(['dashboard.admin.unassigned'])).toBe('admin')
  })

  it('returns admin when user has dashboard.admin.read_all permission', () => {
    expect(resolveDashboardVariant(['dashboard.admin.read_all'])).toBe('admin')
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

  it('returns qc when user has data-entry.checker permission fallback', () => {
    expect(resolveDashboardVariant(['data-entry.checker'])).toBe('qc')
  })

  it('returns editor when user has data-entry.maker permission fallback', () => {
    expect(resolveDashboardVariant(['data-entry.maker'])).toBe('editor')
  })

  it('prioritizes explicit dashboard.editor over data-entry.checker fallback', () => {
    expect(resolveDashboardVariant(['dashboard.editor', 'data-entry.checker'])).toBe('editor')
  })

  it('returns null when user has no dashboard or data-entry permissions', () => {
    expect(resolveDashboardVariant(['projects.read'])).toBe(null)
  })
})
