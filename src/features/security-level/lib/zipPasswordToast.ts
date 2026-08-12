import { toast } from 'sonner'

import i18n from '@/lib/i18n/config'

export type ZipPasswordSource = 'personal_pin' | 'dossier' | 'none'

export const ZIP_PASSWORD_SOURCE_HEADER = 'x-zip-password-source'

export function readZipPasswordSource(
  headers: Record<string, unknown> | undefined,
): ZipPasswordSource {
  if (!headers) return 'none'
  const raw =
    headers[ZIP_PASSWORD_SOURCE_HEADER] ??
    headers['X-Zip-Password-Source'] ??
    headers['x-zip-password-source']
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === 'personal_pin' || value === 'dossier' || value === 'none') {
    return value
  }
  return 'none'
}

/** Toast after a successful ZIP download when the archive was password-locked. */
export function notifyZipPasswordLocked(
  headers: Record<string, unknown> | undefined,
): void {
  const source = readZipPasswordSource(headers)
  if (source === 'personal_pin') {
    toast.info(
      i18n.t('export.zipLockedWithPin', { ns: 'archive-warehouse' }),
    )
    return
  }
  if (source === 'dossier') {
    toast.info(
      i18n.t('export.zipLockedWithDossierPassword', {
        ns: 'archive-warehouse',
      }),
    )
  }
}
