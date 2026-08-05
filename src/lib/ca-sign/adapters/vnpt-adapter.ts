import type { CaAdapter, CaCertificate, CaSignResult } from '@/lib/ca-sign/ca-types'
import { createLocalAgentAdapter } from '@/lib/ca-sign/adapters/local-agent-adapter'

const base = createLocalAgentAdapter('vnpt')

export const vnptCaAdapter: CaAdapter = {
  ...base,
  providerId: 'vnpt',
  async listCertificates(): Promise<Array<CaCertificate>> {
    return base.listCertificates()
  },
  async sign(params): Promise<CaSignResult> {
    return base.sign(params)
  },
}
