import type { ArchiveFieldConfigT } from '@/features/archive-config/types'

export type ArchiveSubmissionStatusT = 'PENDING' | 'APPROVED' | 'REJECTED'

export type ArchiveDossierStatusT =
  | 'APPROVED'
  | 'PENDING_ARCHIVE'
  | 'ARCHIVED'
  | 'ARCHIVE_REJECTED'

export type ArchiveDossierListItemT = {
  id: string
  name: string
  folderPath: string
  status: ArchiveDossierStatusT
  projectCode: string | null
  fondId: string | null
  updatedAt: string
  latestSubmission: {
    id: string
    status: ArchiveSubmissionStatusT
    submittedAt: string
    submittedBy: string
    submitterName: string | null
    rejectNotes: string | null
  } | null
}

export type GetArchiveDossiersParamsT = {
  page?: number
  limit?: number
  status?: ArchiveDossierStatusT
  search?: string
}

export type ArchiveFieldValueSnapshotT = Record<string, unknown>

export type ArchiveFieldConfigSnapshotT = {
  fields: Array<ArchiveFieldConfigT>
  resolvedLabels: Record<string, { id: string; label: string }>
}

export type ArchiveSubmissionT = {
  id: string
  dossierId: string
  dossierName?: string
  dossierStatus?: string
  folderPath?: string
  submittedBy: string
  submitterName?: string | null
  submitterEmail?: string | null
  submittedAt: string
  status: ArchiveSubmissionStatusT
  reviewedBy?: string | null
  reviewedAt?: string | null
  rejectNotes?: string | null
  fieldValues: ArchiveFieldValueSnapshotT
  fieldConfigSnapshot: ArchiveFieldConfigSnapshotT
}

export type PasswordSourceT = 'own' | 'security_level' | 'none'

export type SubmitArchivePayloadT = {
  fieldValues: ArchiveFieldValueSnapshotT
  securityLevelId: string
  accessPassword?: string
  clearAccessPassword?: boolean
  fileSecurityLevels: Array<{
    fileId: string
    securityLevelId: string
    accessPassword?: string
    clearAccessPassword?: boolean
  }>
}

export type PrepareArchiveSubmitFileT = {
  id: string
  fileName: string
  securityLevelId: string | null
  passwordSource?: PasswordSourceT
}

export type PrepareArchiveSubmitT = {
  dossierId: string
  dossierSecurityLevelId: string | null
  dossierPasswordSource?: PasswordSourceT
  files: Array<PrepareArchiveSubmitFileT>
  suggestedFieldValues: ArchiveFieldValueSnapshotT
}

export type RejectArchivePayloadT = {
  rejectNotes: string
}
