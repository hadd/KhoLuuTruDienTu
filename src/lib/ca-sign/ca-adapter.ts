export type {
  CaAdapter,
  CaCertificate,
  CaProviderId,
  CaSignResult,
} from '@/lib/ca-sign/ca-types'

export {
  detectCaAdapter,
  detectCaAdapterAsync,
  detectAllActiveCaAdapters,
  getCaAdapterByProvider,
  getCaInstallGuideUrl,
  getSignAgentInstallHint,
  listSupportedProviders,
  probeSignAgent,
  SIGN_AGENT_BASE_URL,
} from '@/lib/ca-sign/ca-detector'

export { vnptCaAdapter } from '@/lib/ca-sign/adapters/vnpt-adapter'
export { viettelCaAdapter } from '@/lib/ca-sign/adapters/viettel-adapter'
export { bkavCaAdapter } from '@/lib/ca-sign/adapters/bkav-adapter'
export { ca2CaAdapter } from '@/lib/ca-sign/adapters/ca2-adapter'
export {
  localAgentCaAdapter,
  createLocalAgentAdapter,
} from '@/lib/ca-sign/adapters/local-agent-adapter'
