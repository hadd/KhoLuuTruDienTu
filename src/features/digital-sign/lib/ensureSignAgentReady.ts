import {
  probeSignAgent,
  SIGN_AGENT_BASE_URL,
} from '@/lib/ca-sign/adapters/local-agent-adapter'
import { ca2CaAdapter } from '@/lib/ca-sign/adapters/ca2-adapter'

export const SIGN_AGENT_DOWNLOAD_URL =
  'https://github.com/tlong1610/sohoa-sign-agent/releases/download/v1.0.1/SohoaSignAgent-1.0.1-win-x64.zip'

export type SignAgentReadyResult =
  | { ok: true; certificateCount: number }
  | {
      ok: false
      reason: 'agent_offline' | 'no_certificate'
      message: string
      downloadUrl?: string
      healthUrl?: string
    }

/**
 * Same gate pattern as ScanAgentGuard: do not open signing UI unless
 * Sohoa Sign Agent is online and at least one USB-token certificate is available.
 */
export async function ensureSignAgentReady(): Promise<SignAgentReadyResult> {
  const alive = await probeSignAgent()
  if (!alive) {
    return {
      ok: false,
      reason: 'agent_offline',
      message:
        'Sohoa Sign Agent chưa chạy. Vui lòng cài và mở Sohoa Sign Agent, rồi cắm USB Token trước khi ký số.',
      downloadUrl: SIGN_AGENT_DOWNLOAD_URL,
      healthUrl: `${SIGN_AGENT_BASE_URL}/health`,
    }
  }

  try {
    const certs = await ca2CaAdapter.listCertificates()
    if (!certs.length) {
      return {
        ok: false,
        reason: 'no_certificate',
        message:
          'Chưa phát hiện chứng thư số USB Token. Vui lòng cắm Token (CA2/VNPT/Viettel/BKAV) và đảm bảo middleware đã cài.',
        healthUrl: `${SIGN_AGENT_BASE_URL}/health`,
      }
    }
    return { ok: true, certificateCount: certs.length }
  } catch (error) {
    return {
      ok: false,
      reason: 'no_certificate',
      message:
        error instanceof Error
          ? error.message
          : 'Không đọc được chứng thư số từ USB Token.',
      healthUrl: `${SIGN_AGENT_BASE_URL}/health`,
    }
  }
}
