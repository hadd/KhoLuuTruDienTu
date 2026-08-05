import { bkavCaAdapter } from '@/lib/ca-sign/adapters/bkav-adapter'
import { ca2CaAdapter } from '@/lib/ca-sign/adapters/ca2-adapter'
import { viettelCaAdapter } from '@/lib/ca-sign/adapters/viettel-adapter'
import { vnptCaAdapter } from '@/lib/ca-sign/adapters/vnpt-adapter'
import { probeSignAgent, SIGN_AGENT_BASE_URL } from '@/lib/ca-sign/adapters/local-agent-adapter'
import type { CaAdapter, CaProviderId } from '@/lib/ca-sign/ca-types'

/**
 * All CA providers share Sohoa Sign Agent (Windows Certificate Store).
 * We expose a single logical adapter once the agent is alive to avoid
 * listing the same certs four times in the UI.
 */
const ADAPTERS: Array<CaAdapter> = [
  ca2CaAdapter,
  vnptCaAdapter,
  viettelCaAdapter,
  bkavCaAdapter,
]

export function detectCaAdapter(): CaAdapter | null {
  return ADAPTERS[0] ?? null
}

export async function detectCaAdapterAsync(): Promise<CaAdapter | null> {
  const alive = await probeSignAgent()
  return alive ? (ADAPTERS[0] ?? null) : null
}

export async function detectAllActiveCaAdapters(): Promise<Array<CaAdapter>> {
  const alive = await probeSignAgent()
  if (!alive) return []
  // One adapter is enough — certs come from the shared Windows store
  return ADAPTERS[0] ? [ADAPTERS[0]] : []
}

export function listSupportedProviders(): Array<CaProviderId> {
  return ADAPTERS.map((adapter) => adapter.providerId)
}

export function getCaAdapterByProvider(
  providerId: CaProviderId,
): CaAdapter | null {
  return ADAPTERS.find((item) => item.providerId === providerId) ?? null
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

export function getSignAgentInstallHint(): string {
  return `Cài và chạy Sohoa Sign Agent (http://127.0.0.1:18711). Cắm USB Token (CA2/VNPT/Viettel/BKAV) đã cài middleware.`
}

export { SIGN_AGENT_BASE_URL, probeSignAgent }
