import type { CaAdapter, CaCertificate, CaSignResult } from '@/lib/ca-sign/ca-types'

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
  }
}

async function probeViettelLocalService(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (window.ViettelCA) return true

  const ports = [14002, 12800, 8088, 9090]
  for (const port of ports) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 600)
      const res = await fetch(`http://127.0.0.1:${port}/ping`, {
        signal: controller.signal,
      }).catch(() => null)
      clearTimeout(timer)

      if (res && (res.ok || res.status === 404 || res.status === 400 || res.status === 200)) {
        window.ViettelCA = {
          listCerts: async () => {
            const r = await fetch(`http://127.0.0.1:${port}/listCerts`, { mode: 'cors' })
            const data = await r.json()
            return Array.isArray(data) ? data : data.certs ?? data.certificates ?? []
          },
          sign: async (hash, thumbprint, algo) => {
            const r = await fetch(`http://127.0.0.1:${port}/sign`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hash, thumbprint, algo: algo ?? 'SHA256' }),
              mode: 'cors',
            })
            const data = await r.json()
            return typeof data === 'string' ? data : data.signatureBase64 ?? data.signature
          },
        }
        return true
      }
    } catch {
      // Try next port
    }
  }
  return false
}

export const viettelCaAdapter: CaAdapter = {
  providerId: 'viettel',

  detectPlugin(): boolean {
    return typeof window !== 'undefined' && Boolean(window.ViettelCA)
  },

  async detectPluginAsync(): Promise<boolean> {
    if (this.detectPlugin()) return true
    return await probeViettelLocalService()
  },

  async listCertificates(): Promise<Array<CaCertificate>> {
    let plugin = window.ViettelCA
    if (!plugin?.listCerts) {
      await probeViettelLocalService()
      plugin = window.ViettelCA
    }
    if (!plugin?.listCerts) {
      throw new Error('Viettel CA Plugin chưa sẵn sàng')
    }
    const certs = await plugin.listCerts()
    return (certs ?? []).map((cert) => normalizeCert(cert))
  },

  async sign(params): Promise<CaSignResult> {
    let plugin = window.ViettelCA
    if (!plugin?.sign) {
      await probeViettelLocalService()
      plugin = window.ViettelCA
    }
    if (!plugin?.sign) {
      throw new Error('Viettel CA Plugin chưa sẵn sàng')
    }
    const signatureBase64 = await plugin.sign(
      params.hashBase64,
      params.certThumbprint,
      params.hashAlgorithm ?? 'SHA256',
    )
    return { signatureBase64 }
  },
}
