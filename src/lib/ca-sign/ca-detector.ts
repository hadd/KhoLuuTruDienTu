import { bkavCaAdapter } from '@/lib/ca-sign/adapters/bkav-adapter'
import { viettelCaAdapter } from '@/lib/ca-sign/adapters/viettel-adapter'
import { vnptCaAdapter } from '@/lib/ca-sign/adapters/vnpt-adapter'
import type { CaAdapter, CaProviderId } from '@/lib/ca-sign/ca-types'

const ADAPTERS: Array<CaAdapter> = [
  vnptCaAdapter,
  viettelCaAdapter,
  bkavCaAdapter,
]

export function detectCaAdapter(): CaAdapter | null {
  return ADAPTERS.find((adapter) => adapter.detectPlugin()) ?? null
}

export function listSupportedProviders(): Array<CaProviderId> {
  return ADAPTERS.map((adapter) => adapter.providerId)
}

export function getCaAdapterByProvider(
  providerId: CaProviderId,
): CaAdapter | null {
  const adapter = ADAPTERS.find((item) => item.providerId === providerId)
  return adapter?.detectPlugin() ? adapter : null
}

export function getCaInstallGuideUrl(providerId: CaProviderId): string {
  switch (providerId) {
    case 'vnpt':
      return 'https://esign.vnpt.vn/'
    case 'viettel':
      return 'https://viettel-ca.vn/'
    case 'bkav':
      return 'https://www.bkavca.vn/'
    default:
      return '#'
  }
}
