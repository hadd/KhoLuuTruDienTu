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

async function probeBkavLocalService(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (window.bkavPlugin) return true

  const ports = [12800, 9999, 8000, 14003]
  for (const port of ports) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 600)
      const res = await fetch(`http://127.0.0.1:${port}/ping`, {
        signal: controller.signal,
      }).catch(() => null)
      clearTimeout(timer)

      if (res && (res.ok || res.status === 404 || res.status === 400 || res.status === 200)) {
        window.bkavPlugin = {
          getCerts: async () => {
            const r = await fetch(`http://127.0.0.1:${port}/getCerts`, { mode: 'cors' })
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

export const bkavCaAdapter: CaAdapter = {
  providerId: 'bkav',

  detectPlugin(): boolean {
    return typeof window !== 'undefined' && Boolean(window.bkavPlugin)
  },

  async detectPluginAsync(): Promise<boolean> {
    if (this.detectPlugin()) return true
    return await probeBkavLocalService()
  },

  async listCertificates(): Promise<Array<CaCertificate>> {
    let plugin = window.bkavPlugin
    if (!plugin?.getCerts) {
      await probeBkavLocalService()
      plugin = window.bkavPlugin
    }
    if (!plugin?.getCerts) {
      throw new Error('BKAV BKToken Plugin chưa sẵn sàng')
    }
    const certs = await plugin.getCerts()
    return (certs ?? []).map((cert) => normalizeCert(cert))
  },

  async sign(params): Promise<CaSignResult> {
    let plugin = window.bkavPlugin
    if (!plugin?.sign) {
      await probeBkavLocalService()
      plugin = window.bkavPlugin
    }
    if (!plugin?.sign) {
      throw new Error('BKAV BKToken Plugin chưa sẵn sàng')
    }
    const signatureBase64 = await plugin.sign(
      params.hashBase64,
      params.certThumbprint,
      params.hashAlgorithm ?? 'SHA256',
    )
    return { signatureBase64 }
  },
}
