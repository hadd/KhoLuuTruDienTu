import type { CaAdapter, CaCertificate, CaProviderId, CaSignResult } from '@/lib/ca-sign/ca-types'
import { filterSigningCertificates } from '@/lib/ca-sign/certificateDisplay'

/** Sohoa Sign Agent — localhost Windows Certificate Store bridge (Foxit-compatible). */
export const SIGN_AGENT_BASE_URL = 'http://127.0.0.1:18711'
export const SIGN_AGENT_PORT = 18711

function normalizeCert(raw: Record<string, unknown>): CaCertificate {
  return {
    thumbprint: String(
      raw.thumbprint ?? raw.Thumbprint ?? raw.serial ?? raw.SerialNumber ?? '',
    ),
    subject: String(raw.subject ?? raw.Subject ?? raw.cn ?? raw.CN ?? ''),
    issuer: String(raw.issuer ?? raw.Issuer ?? ''),
    validFrom: String(raw.validFrom ?? raw.ValidFrom ?? raw.notBefore ?? ''),
    validTo: String(raw.validTo ?? raw.ValidTo ?? raw.notAfter ?? ''),
    serialNumber: raw.serialNumber
      ? String(raw.serialNumber)
      : raw.SerialNumber
        ? String(raw.SerialNumber)
        : undefined,
    certificateBase64: raw.certificateBase64
      ? String(raw.certificateBase64)
      : raw.CertificateBase64
        ? String(raw.CertificateBase64)
        : undefined,
  }
}

export async function probeSignAgent(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 800)
    const res = await fetch(`${SIGN_AGENT_BASE_URL}/health`, {
      signal: controller.signal,
      mode: 'cors',
    }).catch(() => null)
    clearTimeout(timer)
    return Boolean(res?.ok)
  } catch {
    return false
  }
}

export function createLocalAgentAdapter(providerId: CaProviderId): CaAdapter {
  return {
    providerId,

    detectPlugin(): boolean {
      // Sync detect is optimistic — real check is async via /health
      return typeof window !== 'undefined'
    },

    async detectPluginAsync(): Promise<boolean> {
      return await probeSignAgent()
    },

    async listCertificates(): Promise<Array<CaCertificate>> {
      const alive = await probeSignAgent()
      if (!alive) {
        throw new Error(
          'Sohoa Sign Agent chưa chạy. Vui lòng cài và mở Sohoa Sign Agent, rồi cắm USB Token.',
        )
      }

      const res = await fetch(`${SIGN_AGENT_BASE_URL}/certificates`, { mode: 'cors' })
      if (!res.ok) {
        throw new Error(`Không đọc được chứng thư số từ Sign Agent (HTTP ${res.status})`)
      }
      const data = await res.json()
      const list = Array.isArray(data)
        ? data
        : data.certificates ?? data.certs ?? data.data ?? []
      const certs = filterSigningCertificates(
        (list as Array<Record<string, unknown>>).map(normalizeCert),
      )
      if (!certs.length) {
        throw new Error(
          'Chưa tìm thấy chứng thư số nào trong USB Token. Kiểm tra Token đã cắm và middleware CA đã cài.',
        )
      }
      return certs.map((c) => ({ ...c, providerId }))
    },

    async sign(params): Promise<CaSignResult> {
      const alive = await probeSignAgent()
      if (!alive) {
        throw new Error('Sohoa Sign Agent chưa chạy')
      }

      const res = await fetch(`${SIGN_AGENT_BASE_URL}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({
          thumbprint: params.certThumbprint,
          hashBase64: params.hashBase64,
          hashAlgorithm: params.hashAlgorithm ?? 'SHA256',
        }),
      })

      if (!res.ok) {
        let detail = `HTTP ${res.status}`
        try {
          const errBody = await res.json()
          detail = errBody.detail ?? errBody.title ?? errBody.error ?? detail
        } catch {
          // ignore
        }
        throw new Error(`Ký số thất bại: ${detail}`)
      }

      const data = await res.json()
      const signatureBase64 =
        typeof data === 'string'
          ? data
          : data.signatureBase64 ?? data.signature
      if (!signatureBase64) {
        throw new Error('Sign Agent không trả về chữ ký')
      }
      return { signatureBase64: String(signatureBase64) }
    },
  }
}

export const localAgentCaAdapter = createLocalAgentAdapter('ca2')
