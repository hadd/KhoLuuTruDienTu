import { useStore } from '@tanstack/react-store'
import { Store } from '@tanstack/store'

import type { EditorErrorReportT } from '@/features/data-management/types'

const STORAGE_KEY = 'data-management:editor-error-reports'

type EditorErrorReportState = {
  reports: Array<EditorErrorReportT>
}

function readPersistedReports(): Array<EditorErrorReportT> {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<EditorErrorReportState>
    return Array.isArray(parsed.reports) ? parsed.reports : []
  } catch {
    return []
  }
}

function persistReports(reports: Array<EditorErrorReportT>) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ reports }))
  } catch {
    // ignore persistence errors
  }
}

const editorErrorReportStoreInstance = new Store<EditorErrorReportState>({
  reports: readPersistedReports(),
})

function setReports(reports: Array<EditorErrorReportT>) {
  editorErrorReportStoreInstance.setState({ reports })
  persistReports(reports)
}

export const editorErrorReportStore = {
  subscribe: editorErrorReportStoreInstance.subscribe,
  getState: () => editorErrorReportStoreInstance.state,
  setReports,
  upsertReport: (report: EditorErrorReportT) => {
    const current = editorErrorReportStoreInstance.state.reports
    const index = current.findIndex((item) => item.id === report.id)
    if (index === -1) {
      setReports([report, ...current])
      return
    }
    const next = [...current]
    next[index] = report
    setReports(next)
  },
}

export function useEditorErrorReportList() {
  return useStore(
    editorErrorReportStoreInstance,
    (state) => state.reports,
  )
}
