import { afterEach, describe, expect, it } from 'vitest'

import {
  buildSecurityAccessHeaders,
  clearAllSecurityAccessTokens,
  getDossierAccessToken,
  getFileAccessToken,
  getRememberedDossierSecurityLevel,
  getSecurityLevelAccessToken,
  parsePasswordRequiredError,
  rememberDossierSecurityLevel,
  rememberDossierUnlockedFile,
  rememberDossierUnlockedSecurityLevel,
  setDossierAccessToken,
  setFileAccessToken,
  setSecurityLevelAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'

const DOSSIER_A = '11111111-1111-4111-8111-111111111111'
const DOSSIER_B = '22222222-2222-4222-8222-222222222222'
const FILE_A = '33333333-3333-4333-8333-333333333333'
const FILE_B = '44444444-4444-4444-8444-444444444444'
const LEVEL_A = '55555555-5555-4555-8555-555555555555'

afterEach(() => {
  clearAllSecurityAccessTokens()
})

describe('dossier access tokens', () => {
  it('attaches all valid dossier tokens to batch requests within a module', () => {
    setDossierAccessToken('warehouse', DOSSIER_A, 'token-a', 900)
    setDossierAccessToken('warehouse', DOSSIER_B, 'token-b', 900)

    expect(
      buildSecurityAccessHeaders({ module: 'warehouse' }),
    ).toMatchObject({
      'x-dossier-access-tokens': 'token-a,token-b',
    })
  })

  it('does not leak warehouse unlock tokens into exploitation headers', () => {
    setDossierAccessToken('warehouse', DOSSIER_A, 'token-warehouse', 900)
    setFileAccessToken('warehouse', FILE_A, 'file-warehouse', 900)
    setSecurityLevelAccessToken('warehouse', LEVEL_A, 'level-warehouse', 900)

    expect(
      buildSecurityAccessHeaders({
        module: 'exploitation',
        dossierId: DOSSIER_A,
      }),
    ).toEqual({})

    expect(
      buildSecurityAccessHeaders({
        module: 'warehouse',
        dossierId: DOSSIER_A,
      }),
    ).toMatchObject({
      'x-dossier-access-token': 'token-warehouse',
      'x-dossier-access-tokens': 'token-warehouse',
      'x-file-access-tokens': 'file-warehouse',
      'x-security-level-tokens': 'level-warehouse',
    })
  })

  it('does not leak exploitation unlock tokens into warehouse headers', () => {
    setDossierAccessToken('exploitation', DOSSIER_A, 'token-lib', 900)

    expect(
      buildSecurityAccessHeaders({
        module: 'warehouse',
        dossierId: DOSSIER_A,
      }),
    ).toEqual({})

    expect(getDossierAccessToken('warehouse', DOSSIER_A)).toBeUndefined()
    expect(getDossierAccessToken('exploitation', DOSSIER_A)).toBe(
      'token-lib',
    )
  })

  it('returns empty headers when module is missing', () => {
    setDossierAccessToken('warehouse', DOSSIER_A, 'token-a', 900)
    expect(buildSecurityAccessHeaders({ dossierId: DOSSIER_A })).toEqual({})
    expect(buildSecurityAccessHeaders()).toEqual({})
  })

  it('parses the dossier id from a password-required error', () => {
    expect(
      parsePasswordRequiredError(`PASSWORD_REQUIRED:dossier:${DOSSIER_B}`),
    ).toEqual({
      scope: 'dossier',
      dossierId: DOSSIER_B,
    })
  })

  it('parses file password-required errors and keeps file tokens separate', () => {
    setFileAccessToken('warehouse', FILE_A, 'file-token-a', 900)
    setFileAccessToken('warehouse', FILE_B, 'file-token-b', 900)

    expect(
      parsePasswordRequiredError(
        `PASSWORD_REQUIRED:file:${FILE_A}:${LEVEL_A}`,
      ),
    ).toEqual({
      scope: 'file',
      fileId: FILE_A,
      securityLevelId: LEVEL_A,
    })

    expect(
      buildSecurityAccessHeaders({ module: 'warehouse' }),
    ).toMatchObject({
      'x-file-access-tokens': 'file-token-a,file-token-b',
    })
  })

  it('clears every in-memory security unlock token across modules', () => {
    setDossierAccessToken('warehouse', DOSSIER_A, 'token-a', 900)
    setDossierAccessToken('exploitation', DOSSIER_B, 'token-b', 900)
    setFileAccessToken('warehouse', FILE_A, 'file-token-a', 900)
    setSecurityLevelAccessToken('exploitation', LEVEL_A, 'level-token-a', 900)
    rememberDossierSecurityLevel('warehouse', DOSSIER_A, LEVEL_A)
    rememberDossierUnlockedSecurityLevel('warehouse', DOSSIER_A, LEVEL_A)
    rememberDossierUnlockedFile('exploitation', DOSSIER_B, FILE_A)

    clearAllSecurityAccessTokens()

    expect(getDossierAccessToken('warehouse', DOSSIER_A)).toBeUndefined()
    expect(getDossierAccessToken('exploitation', DOSSIER_B)).toBeUndefined()
    expect(getFileAccessToken('warehouse', FILE_A)).toBeUndefined()
    expect(getSecurityLevelAccessToken('exploitation', LEVEL_A)).toBeUndefined()
    expect(
      getRememberedDossierSecurityLevel('warehouse', DOSSIER_A),
    ).toBeUndefined()
    expect(buildSecurityAccessHeaders({ module: 'warehouse' })).toEqual({})
    expect(buildSecurityAccessHeaders({ module: 'exploitation' })).toEqual({})
  })
})
