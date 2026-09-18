// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { streamDownloadToDisk } from '@/lib/api/streamDownload'

const { ensureFreshAccessToken, notifyZipPasswordLocked } = vi.hoisted(() => ({
  ensureFreshAccessToken: vi.fn(() => Promise.resolve('token-123')),
  notifyZipPasswordLocked: vi.fn(),
}))

vi.mock('@/lib/api/apiClient', () => ({
  ensureFreshAccessToken,
  AuthenticationError: class AuthenticationError extends Error {},
}))

vi.mock('@/features/security-level/lib/securityAccessTokenStore', () => ({
  buildSecurityAccessHeaders: vi.fn(() => ({})),
}))

vi.mock('@/features/security-level/lib/zipPasswordToast', () => ({
  notifyZipPasswordLocked,
}))

vi.mock('@/lib/utils/env', () => ({
  env: {
    API_URL: 'http://example.test',
  },
}))

describe('streamDownloadToDisk native fallback', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    ensureFreshAccessToken.mockClear()
    notifyZipPasswordLocked.mockClear()
    document.body.innerHTML = ''
    ;(window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker =
      undefined
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    document.body.innerHTML = ''
  })

  it('creates a native download ticket instead of buffering a blob', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === 'http://example.test/api/v1/export-downloads') {
        return Promise.resolve(new Response(
          JSON.stringify({
            id: 'ticket-1',
            downloadUrl: '/api/public/export-downloads/ticket-1',
            statusUrl: '/api/v1/export-downloads/ticket-1/status',
            expiresAt: Date.now() + 60_000,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ))
      }
      if (url === 'http://example.test/api/v1/export-downloads/ticket-1/status') {
        return Promise.resolve(new Response(
          JSON.stringify({
            id: 'ticket-1',
            state: 'completed',
            zipPasswordSource: 'none',
            createdAt: Date.now(),
            expiresAt: Date.now() + 60_000,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    await streamDownloadToDisk({
      method: 'POST',
      path: '/api/v1/dossiers/metadata/export',
      body: { dossierIds: ['abc'] },
      fallbackFileName: 'demo.zip',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://example.test/api/v1/export-downloads',
    )
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://example.test/api/v1/export-downloads/ticket-1/status',
    )
    const iframe = document.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toBe(
      'http://example.test/api/public/export-downloads/ticket-1',
    )
    expect(notifyZipPasswordLocked).toHaveBeenCalledWith({
      'x-zip-password-source': 'none',
    })
  })
})
