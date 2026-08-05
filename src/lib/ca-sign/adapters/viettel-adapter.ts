import type { CaAdapter, CaCertificate, CaSignResult } from '@/lib/ca-sign/ca-types'
import { createLocalAgentAdapter } from '@/lib/ca-sign/adapters/local-agent-adapter'

const base = createLocalAgentAdapter('viettel')

export const viettelCaAdapter: CaAdapter = {
  ...base,
  providerId: 'viettel',
  async listCertificates(): Promise<Array<CaCertificate>> {
    return base.listCertificates()
  },
  async sign(params): Promise<CaSignResult> {
    return base.sign(params)
  },
}
