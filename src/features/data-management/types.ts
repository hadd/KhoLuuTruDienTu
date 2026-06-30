export * from './types.d'

export class DataManagementUploadError extends Error {
  constructor(
    public readonly code: 'mixedFolder' | 'invalidFile',
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'DataManagementUploadError'
  }
}
