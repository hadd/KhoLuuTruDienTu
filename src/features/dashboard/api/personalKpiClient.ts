import type { PersonalDailyKpiT, PersonalKpisT } from '@/features/dashboard/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

type PersonalKpisRawT = Partial<PersonalKpisT> & {
  days?: Array<Partial<PersonalDailyKpiT>>
  total?: Partial<PersonalDailyKpiT>
}

function isRecordWrapper<T>(
  data: T | SingleResourceResponse<T>,
): data is SingleResourceResponse<T> {
  return typeof data === 'object' && data !== null && 'record' in data
}

function unwrapResponse<T>(data: T | SingleResourceResponse<T>): T {
  if (isRecordWrapper(data)) {
    return data.record
  }

  return data
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeRow(row: Partial<PersonalDailyKpiT> | undefined, date: string): PersonalDailyKpiT {
  return {
    date: row?.date ?? date,
    assignedDossiersCount: toNumber(row?.assignedDossiersCount),
    completedDossiersCount: toNumber(row?.completedDossiersCount),
    rejectedDossiersCount: toNumber(row?.rejectedDossiersCount),
    assignedPagesCount: toNumber(row?.assignedPagesCount),
    completedPagesCount: toNumber(row?.completedPagesCount),
    assignedFilesCount: toNumber(row?.assignedFilesCount),
    completedFilesCount: toNumber(row?.completedFilesCount),
    dossierCompletionRate: toNumber(row?.dossierCompletionRate),
    pageCompletionRate: toNumber(row?.pageCompletionRate),
    fileCompletionRate: toNumber(row?.fileCompletionRate),
    makerAssignedDossiersCount: toNumber(row?.makerAssignedDossiersCount),
    makerCompletedDossiersCount: toNumber(row?.makerCompletedDossiersCount),
    makerAssignedPagesCount: toNumber(row?.makerAssignedPagesCount),
    makerCompletedPagesCount: toNumber(row?.makerCompletedPagesCount),
    makerAssignedFilesCount: toNumber(row?.makerAssignedFilesCount),
    makerCompletedFilesCount: toNumber(row?.makerCompletedFilesCount),
    makerDossierCompletionRate: toNumber(row?.makerDossierCompletionRate),
    makerPageCompletionRate: toNumber(row?.makerPageCompletionRate),
    makerFileCompletionRate: toNumber(row?.makerFileCompletionRate),
    qcAssignedDossiersCount: toNumber(row?.qcAssignedDossiersCount),
    qcCompletedDossiersCount: toNumber(row?.qcCompletedDossiersCount),
    qcAssignedPagesCount: toNumber(row?.qcAssignedPagesCount),
    qcCompletedPagesCount: toNumber(row?.qcCompletedPagesCount),
    qcAssignedFilesCount: toNumber(row?.qcAssignedFilesCount),
    qcCompletedFilesCount: toNumber(row?.qcCompletedFilesCount),
    qcDossierCompletionRate: toNumber(row?.qcDossierCompletionRate),
    qcPageCompletionRate: toNumber(row?.qcPageCompletionRate),
    qcFileCompletionRate: toNumber(row?.qcFileCompletionRate),
    accuracyRate: toNumber(row?.accuracyRate),
    avgProcessingTimeMinutes: toNumber(row?.avgProcessingTimeMinutes),
    kpiStatus: row?.kpiStatus ?? 'GOOD',
  }
}

export const getPersonalDailyKpis = async (
  dateFrom?: string,
  dateTo?: string,
): Promise<PersonalKpisT> => {
  const response = await apiClient.get<
    PersonalKpisRawT | SingleResourceResponse<PersonalKpisRawT>
  >('/api/v1/dashboard/personal-kpis', {
    timeout: 90_000,
    params: {
      dateFrom,
      dateTo,
    },
  })

  const raw = unwrapResponse(response.data)
  const days = (raw.days ?? []).map((row, index) =>
    normalizeRow(row, row.date ?? `#${index + 1}`),
  )

  return {
    days,
    total: normalizeRow(raw.total, 'total'),
  }
}
