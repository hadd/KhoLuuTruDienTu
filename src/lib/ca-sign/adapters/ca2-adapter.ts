import type { CaAdapter, CaCertificate, CaSignResult } from '@/lib/ca-sign/ca-types'

function normalizeCert(raw: Record<string, unknown>): CaCertificate {
  const thumbprint = String(
    raw.thumbprint ?? raw.Thumbprint ?? raw.serial ?? raw.SerialNumber ?? raw.id ?? raw.Id ?? '',
  )
  const subject = String(
    raw.subject ??
      raw.Subject ??
      raw.cn ??
      raw.CN ??
      raw.certName ??
      raw.CertName ??
      raw.name ??
      raw.Name ??
      raw.issuer ??
      raw.Issuer ??
      thumbprint,
  )
  return {
    thumbprint,
    subject,
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

function getCa2PluginObject(): Record<string, any> | null {
  if (typeof window === 'undefined') return null
  const win = window as any
  return (
    win.CA2 ??
    win.CA2Plugin ??
    win.CA2_CA ??
    win.NacencommCA ??
    win.ca2Signer ??
    win.ca2Plugin ??
    win.SignerPlugin ??
    win.signer ??
    null
  )
}

async function fetchCertificatesFromCa2WebSocket(): Promise<Array<CaCertificate> | null> {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return null

  const ports = [12845, 12800, 14004, 9000]
  for (const port of ports) {
    try {
      const certs = await new Promise<Array<any> | null>((resolve) => {
        let isDone = false
        const ws = new WebSocket(`ws://127.0.0.1:${port}`)
        const timer = setTimeout(() => {
          if (!isDone) {
            isDone = true
            try { ws.close() } catch {}
            resolve(null)
          }
        }, 800)

        ws.onopen = () => {
          ws.send(JSON.stringify({ cmd: 'GET_CERTIFICATES', action: 'getCertificates' }))
        }

        ws.onmessage = (evt) => {
          if (isDone) return
          try {
            const data = JSON.parse(evt.data)
            const list = Array.isArray(data) ? data : data.certs ?? data.certificates ?? data.data
            if (Array.isArray(list) && list.length > 0) {
              isDone = true
              clearTimeout(timer)
              try { ws.close() } catch {}
              resolve(list)
            }
          } catch {}
        }

        ws.onerror = () => {
          if (!isDone) {
            isDone = true
            clearTimeout(timer)
            resolve(null)
          }
        }
      })

      if (certs && certs.length > 0) {
        return certs.map((c: any) => normalizeCert(c))
      }
    } catch {}
  }
  return null
}

async function probeCa2LocalService(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (getCa2PluginObject() !== null) return true

  const ports = [12800, 12845, 14004, 14002, 8080, 7070]
  for (const port of ports) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 600)
      const res = await fetch(`http://127.0.0.1:${port}/ping`, {
        signal: controller.signal,
      }).catch(() => null)
      clearTimeout(timer)

      if (res && (res.ok || res.status === 404 || res.status === 400 || res.status === 200)) {
        window.CA2 = {
          getCertificates: async () => {
            const r = await fetch(`http://127.0.0.1:${port}/getCertificates`, { mode: 'cors' })
            const data = await r.json()
            return Array.isArray(data) ? data : data.certs ?? data.certificates ?? []
          },
          signData: async (hash: string, thumbprint: string, algo?: string) => {
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
    } catch {}
  }
  return false
}

export const ca2CaAdapter: CaAdapter = {
  providerId: 'ca2',

  detectPlugin(): boolean {
    return true
  },

  async detectPluginAsync(): Promise<boolean> {
    return true
  },

  async listCertificates(): Promise<Array<CaCertificate>> {
    // 1. Check window plugin object injected by CA2 Extension
    let plugin = getCa2PluginObject()
    if (plugin) {
      const fetchCerts =
        plugin.getCertificates ??
        plugin.listCertificates ??
        plugin.listCerts ??
        plugin.getCerts ??
        plugin.GetCertificates ??
        plugin.ListCertificates

      if (fetchCerts && typeof fetchCerts === 'function') {
        try {
          const certs = await fetchCerts.call(plugin)
          if (Array.isArray(certs) && certs.length > 0) {
            return certs.map((cert: any) => normalizeCert(cert))
          }
        } catch (err) {
          console.warn('CA2 fetchCerts error:', err)
        }
      }
    }

    // 2. Query CA2 Local WebSocket Agent
    const wsCerts = await fetchCertificatesFromCa2WebSocket()
    if (wsCerts && wsCerts.length > 0) {
      return wsCerts
    }

    // 3. Probe Local HTTP REST Service
    const hasHttpService = await probeCa2LocalService()
    if (hasHttpService) {
      plugin = getCa2PluginObject()
      if (plugin?.getCertificates) {
        try {
          const certs = await plugin.getCertificates()
          if (Array.isArray(certs) && certs.length > 0) {
            return certs.map((cert: any) => normalizeCert(cert))
          }
        } catch {}
      }
    }

    // Explicit error if no USB Token certificate could be dynamically fetched
    throw new Error('Chưa tìm thấy chứng thư số nào trong USB Token CA2. Vui lòng kiểm tra thiết bị USB Token đã cắm chắc chắn vào máy tính.')
  },

  async sign(params): Promise<CaSignResult> {
    let plugin = getCa2PluginObject()
    if (!plugin) {
      await probeCa2LocalService()
      plugin = getCa2PluginObject()
    }

    const doSign =
      plugin?.signData ??
      plugin?.sign ??
      plugin?.SignData ??
      plugin?.Sign

    if (doSign && typeof doSign === 'function') {
      const signatureBase64 = await doSign.call(
        plugin,
        params.hashBase64,
        params.certThumbprint,
        params.hashAlgorithm ?? 'SHA256',
      )
      if (signatureBase64) {
        return { signatureBase64: String(signatureBase64) }
      }
    }

    throw new Error('Không thể ký số từ USB Token CA2. Vui lòng kiểm tra lại kết nối CA2 Token Manager.')
  },
}
