import { afterEach, describe, expect, it } from 'vitest'

import {
  buildSecurityAccessHeaders,
  clearDossierAccessToken,
  parsePasswordRequiredError,
  setDossierAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'

const DOSSIER_A = '11111111-1111-4111-8111-111111111111'
const DOSSIER_B = '22222222-2222-4222-8222-222222222222'

afterEach(() => {
  clearDossierAccessToken(DOSSIER_A)
  clearDossierAccessToken(DOSSIER_B)
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
})
