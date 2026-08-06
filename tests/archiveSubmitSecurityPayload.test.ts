import { describe, expect, it } from 'vitest'

function buildSubmitSecurityPayload(input: {
  dossierSecurityLevelId: string
  files: Array<{
    fileId: string
    securityLevelId: string
  }>
}) {
  return {
    securityLevelId: input.dossierSecurityLevelId,
    fileSecurityLevels: input.files.map((file) => ({
      fileId: file.fileId,
      securityLevelId: file.securityLevelId,
    })),
  }
}

describe('archive submit security payload', () => {
  it('sends only security levels without access passwords', () => {
    const payload = buildSubmitSecurityPayload({
      dossierSecurityLevelId: 'level-1',
      files: [
        {
          fileId: 'file-1',
          securityLevelId: 'level-2',
        },
        {
          fileId: 'file-2',
          securityLevelId: 'level-1',
        },
      ],
    })

    expect(payload).toEqual({
      securityLevelId: 'level-1',
      fileSecurityLevels: [
        {
          fileId: 'file-1',
          securityLevelId: 'level-2',
        },
        {
          fileId: 'file-2',
          securityLevelId: 'level-1',
        },
      ],
    })
    expect(payload).not.toHaveProperty('accessPassword')
    expect(payload).not.toHaveProperty('clearAccessPassword')
    expect(payload.fileSecurityLevels[0]).not.toHaveProperty('accessPassword')
    expect(payload.fileSecurityLevels[0]).not.toHaveProperty('clearAccessPassword')
  })
})
