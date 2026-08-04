import { bkavCaAdapter } from '@/lib/ca-sign/adapters/bkav-adapter'
import { ca2CaAdapter } from '@/lib/ca-sign/adapters/ca2-adapter'
import { viettelCaAdapter } from '@/lib/ca-sign/adapters/viettel-adapter'
import { vnptCaAdapter } from '@/lib/ca-sign/adapters/vnpt-adapter'
import type { CaAdapter, CaProviderId } from '@/lib/ca-sign/ca-types'

const ADAPTERS: Array<CaAdapter> = [
  ca2CaAdapter,
]

export function detectCaAdapter(): CaAdapter | null {
  return ADAPTERS.find((adapter) => adapter.detectPlugin()) ?? null
}

export async function detectCaAdapterAsync(): Promise<CaAdapter | null> {
  const syncAdapter = detectCaAdapter()
  if (syncAdapter) return syncAdapter

  for (const adapter of ADAPTERS) {
    if (adapter.detectPluginAsync) {
      const isDetected = await adapter.detectPluginAsync()
      if (isDetected) return adapter
    }
  }
  return null
}

export async function detectAllActiveCaAdapters(): Promise<Array<CaAdapter>> {
  const active: Array<CaAdapter> = []
  for (const adapter of ADAPTERS) {
    let ok = adapter.detectPlugin()
    if (!ok && adapter.detectPluginAsync) {
      ok = await adapter.detectPluginAsync()
    }
    if (ok) {
      active.push(adapter)
    }
  }
  return active
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
    case 'ca2':
      return 'https://ca2.vn/'
    default:
      return '#'
  }
}
