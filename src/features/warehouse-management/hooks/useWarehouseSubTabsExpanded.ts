import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'fsi.warehouse.subTabsExpanded'

function readStoredExpanded(): boolean {
  if (typeof window === 'undefined') return true
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === 'false') return false
  if (raw === 'true') return true
  return true
}

export function useWarehouseSubTabsExpanded() {
  const [expanded, setExpandedState] = useState(readStoredExpanded)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(expanded))
  }, [expanded])

  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next)
  }, [])

  const toggleExpanded = useCallback(() => {
    setExpandedState((prev) => !prev)
  }, [])

  return { expanded, setExpanded, toggleExpanded }
}
