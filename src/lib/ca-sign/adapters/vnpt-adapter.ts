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

let detectedPort: number | null = null

async function probeVnptLocalService(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (window.VNPT_CA) return true

  const ports = [12800, 12801, 14003, 7070, 8080]
  for (const port of ports) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 600)
      const res = await fetch(`http://127.0.0.1:${port}/ping`, {
        signal: controller.signal,
      }).catch(() => null)
      clearTimeout(timer)

      if (res && (res.ok || res.status === 404 || res.status === 400 || res.status === 200)) {
        detectedPort = port
        window.VNPT_CA = {
          getCertificates: async () => {
            const r = await fetch(`http://127.0.0.1:${port}/getCertificates`, { mode: 'cors' })
            const data = await r.json()
            return Array.isArray(data) ? data : data.certs ?? data.certificates ?? []
          },
          signData: async (hash, thumbprint, algo) => {
            const r = await fetch(`http://127.0.0.1:${port}/signData`, {
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

export const vnptCaAdapter: CaAdapter = {
  providerId: 'vnpt',

  detectPlugin(): boolean {
    return typeof window !== 'undefined' && Boolean(window.VNPT_CA)
  },

  async detectPluginAsync(): Promise<boolean> {
    if (this.detectPlugin()) return true
    return await probeVnptLocalService()
  },

  async listCertificates(): Promise<Array<CaCertificate>> {
    let plugin = window.VNPT_CA
    if (!plugin?.getCertificates) {
      await probeVnptLocalService()
      plugin = window.VNPT_CA
    }
    if (!plugin?.getCertificates) {
      throw new Error('VNPT eSign Plugin chưa sẵn sàng')
    }
    const certs = await plugin.getCertificates()
    return (certs ?? []).map((cert) => normalizeCert(cert))
  },

  async sign(params): Promise<CaSignResult> {
    let plugin = window.VNPT_CA
    if (!plugin?.signData) {
      await probeVnptLocalService()
      plugin = window.VNPT_CA
    }
    if (!plugin?.signData) {
      throw new Error('VNPT eSign Plugin chưa sẵn sàng')
    }
    const signatureBase64 = await plugin.signData(
      params.hashBase64,
      params.certThumbprint,
      params.hashAlgorithm ?? 'SHA256',
    )
    return { signatureBase64 }
  },
}
