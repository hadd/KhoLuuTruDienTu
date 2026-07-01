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

export const bkavCaAdapter: CaAdapter = {
  providerId: 'bkav',

  detectPlugin(): boolean {
    return typeof window !== 'undefined' && Boolean(window.bkavPlugin)
  },

  async listCertificates(): Promise<Array<CaCertificate>> {
    const plugin = window.bkavPlugin
    if (!plugin?.getCerts) {
      throw new Error('BKAV BKToken Plugin chưa sẵn sàng')
    }
    const certs = await plugin.getCerts()
    return (certs ?? []).map((cert) => normalizeCert(cert))
  },

  async sign(params): Promise<CaSignResult> {
    const plugin = window.bkavPlugin
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
