import { afterEach, describe, expect, it } from 'vitest'

import {
  buildSecurityAccessHeaders,
  clearDossierAccessToken,
  clearFileAccessToken,
  parsePasswordRequiredError,
  setDossierAccessToken,
  setFileAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'

const DOSSIER_A = '11111111-1111-4111-8111-111111111111'
const DOSSIER_B = '22222222-2222-4222-8222-222222222222'
const FILE_A = '33333333-3333-4333-8333-333333333333'
const FILE_B = '44444444-4444-4444-8444-444444444444'
const LEVEL_A = '55555555-5555-4555-8555-555555555555'

afterEach(() => {
  clearDossierAccessToken(DOSSIER_A)
  clearDossierAccessToken(DOSSIER_B)
  clearFileAccessToken(FILE_A)
  clearFileAccessToken(FILE_B)
})

describe('dossier access tokens', () => {
  it('attaches all valid dossier tokens to batch requests', () => {
    setDossierAccessToken(DOSSIER_A, 'token-a', 900)
    setDossierAccessToken(DOSSIER_B, 'token-b', 900)

    expect(buildSecurityAccessHeaders()).toMatchObject({
      'x-dossier-access-tokens': 'token-a,token-b',
    })
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
    setFileAccessToken(FILE_A, 'file-token-a', 900)
    setFileAccessToken(FILE_B, 'file-token-b', 900)

    expect(
      parsePasswordRequiredError(
        `PASSWORD_REQUIRED:file:${FILE_A}:${LEVEL_A}`,
      ),
    ).toEqual({
      scope: 'file',
      fileId: FILE_A,
      securityLevelId: LEVEL_A,
    })

    expect(buildSecurityAccessHeaders()).toMatchObject({
      'x-file-access-tokens': 'file-token-a,file-token-b',
    })
  })
})
