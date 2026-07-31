import { describe, expect, it } from 'vitest'

type PasswordModeT = 'inherit' | 'custom' | 'clear'

function buildSubmitSecurityPayload(input: {
  dossierSecurityLevelId: string
  dossierPasswordMode: PasswordModeT
  dossierPassword: string
  files: Array<{
    fileId: string
    securityLevelId: string
    mode: PasswordModeT
    password: string
  }>
}) {
  return {
    securityLevelId: input.dossierSecurityLevelId,
    ...(input.dossierPasswordMode === 'custom'
      ? { accessPassword: input.dossierPassword.trim() }
      : {}),
    ...(input.dossierPasswordMode === 'clear' ? { clearAccessPassword: true } : {}),
    fileSecurityLevels: input.files.map((file) => ({
      fileId: file.fileId,
      securityLevelId: file.securityLevelId,
      ...(file.mode === 'custom' ? { accessPassword: file.password.trim() } : {}),
      ...(file.mode === 'clear' ? { clearAccessPassword: true } : {}),
    })),
  }
}

describe('archive submit security payload', () => {
  it('sends dossier and file custom passwords without confirm fields', () => {
    const payload = buildSubmitSecurityPayload({
      dossierSecurityLevelId: 'level-1',
      dossierPasswordMode: 'custom',
      dossierPassword: ' dossier-secret ',
      files: [
        {
          fileId: 'file-1',
          securityLevelId: 'level-2',
          mode: 'custom',
          password: ' file-secret ',
        },
        {
          fileId: 'file-2',
          securityLevelId: 'level-1',
          mode: 'inherit',
          password: 'ignored',
        },
      ],
    })

    expect(payload).toEqual({
      securityLevelId: 'level-1',
      accessPassword: 'dossier-secret',
      fileSecurityLevels: [
        {
          fileId: 'file-1',
          securityLevelId: 'level-2',
          accessPassword: 'file-secret',
        },
        {
          fileId: 'file-2',
          securityLevelId: 'level-1',
        },
      ],
    })
  })

  it('sends clear flags when clearing overrides', () => {
    const payload = buildSubmitSecurityPayload({
      dossierSecurityLevelId: 'level-1',
      dossierPasswordMode: 'clear',
      dossierPassword: '',
      files: [
        {
          fileId: 'file-1',
          securityLevelId: 'level-1',
          mode: 'clear',
          password: '',
        },
      ],
    })

    expect(payload.clearAccessPassword).toBe(true)
    expect(payload.fileSecurityLevels[0]?.clearAccessPassword).toBe(true)
    expect(payload.accessPassword).toBeUndefined()
  })
})
