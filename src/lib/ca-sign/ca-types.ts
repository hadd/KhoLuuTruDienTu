export type CaProviderId = 'vnpt' | 'viettel' | 'bkav' | 'ca2'

export interface CaCertificate {
  thumbprint: string
  subject: string
  issuer: string
  validFrom: string
  validTo: string
  serialNumber?: string
  providerId?: CaProviderId
  /** DER certificate Base64 — required for CMS embedding on server */
  certificateBase64?: string
}

export interface CaSignResult {
  signatureBase64: string
  certificateBase64?: string
}

export interface CaAdapter {
  readonly providerId: CaProviderId
  detectPlugin(): boolean
  detectPluginAsync?(): Promise<boolean>
  listCertificates(): Promise<Array<CaCertificate>>
  sign(params: {
    hashBase64: string
    certThumbprint: string
    hashAlgorithm?: 'SHA256' | 'SHA1'
  }): Promise<CaSignResult>
}
