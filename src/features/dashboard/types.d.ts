export type PersonalDailyKpiT = {
  date: string
  assignedDossiersCount: number
  completedDossiersCount: number
  rejectedDossiersCount: number
  assignedPagesCount: number
  completedPagesCount: number
  assignedFilesCount: number
  completedFilesCount: number
  dossierCompletionRate: number
  pageCompletionRate: number
  fileCompletionRate: number
  makerAssignedDossiersCount: number
  makerCompletedDossiersCount: number
  makerAssignedPagesCount: number
  makerCompletedPagesCount: number
  makerAssignedFilesCount: number
  makerCompletedFilesCount: number
  makerDossierCompletionRate: number
  makerPageCompletionRate: number
  makerFileCompletionRate: number
  qcAssignedDossiersCount: number
  qcCompletedDossiersCount: number
  qcAssignedPagesCount: number
  qcCompletedPagesCount: number
  qcAssignedFilesCount: number
  qcCompletedFilesCount: number
  qcDossierCompletionRate: number
  qcPageCompletionRate: number
  qcFileCompletionRate: number
  accuracyRate: number
  avgProcessingTimeMinutes: number
  kpiStatus: string
}

export type PersonalKpisT = {
  days: Array<PersonalDailyKpiT>
  total: PersonalDailyKpiT
}
