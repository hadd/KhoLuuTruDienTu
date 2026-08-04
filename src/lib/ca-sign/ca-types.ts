export type CaProviderId = 'vnpt' | 'viettel' | 'bkav' | 'ca2'

export interface CaCertificate {
  thumbprint: string
  subject: string
  issuer: string
  validFrom: string
  validTo: string
  serialNumber?: string
  providerId?: CaProviderId
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

declare global {
  interface Window {
    VNPT_CA?: {
      getCertificates?: () => Promise<Array<Record<string, unknown>>>
      signData?: (
        hash: string,
        thumbprint: string,
        algo?: string,
      ) => Promise<string>
    }
    ViettelCA?: {
      listCerts?: () => Promise<Array<Record<string, unknown>>>
      sign?: (
        hash: string,
        thumbprint: string,
        algo?: string,
      ) => Promise<string>
    }
    bkavPlugin?: {
      getCerts?: () => Promise<Array<Record<string, unknown>>>
      sign?: (
        hash: string,
        thumbprint: string,
        algo?: string,
      ) => Promise<string>
    }
    CA2?: {
      getCertificates?: () => Promise<Array<Record<string, unknown>>>
      listCerts?: () => Promise<Array<Record<string, unknown>>>
      signData?: (
        hash: string,
        thumbprint: string,
        algo?: string,
      ) => Promise<string>
      sign?: (
        hash: string,
        thumbprint: string,
        algo?: string,
      ) => Promise<string>
    }
    CA2Plugin?: {
      getCertificates?: () => Promise<Array<Record<string, unknown>>>
      signData?: (
        hash: string,
        thumbprint: string,
        algo?: string,
      ) => Promise<string>
    }
  }
}
