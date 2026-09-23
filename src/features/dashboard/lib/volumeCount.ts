/** Dashboard stats may be a plain count or a workload volume. */
export function volumeCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (value && typeof value === 'object' && 'dossiers' in value) {
    const dossiers = (value as { dossiers?: unknown }).dossiers
    if (typeof dossiers === 'number' && Number.isFinite(dossiers)) {
      return dossiers
    }
  }
  return 0
}
