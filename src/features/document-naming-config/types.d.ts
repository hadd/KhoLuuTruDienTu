export type DocumentNamingTargetTypeT = 'dossier' | 'file'

export type DocumentNamingSegmentSourceT =
  | 'fixed'
  | 'auto_increment'
  | 'year'
  | 'month'
  | 'day'
  | 'fond_field'
  | 'dossier_field'
  | 'file_field'

export type DocumentNamingSegmentT = {
  length: number
  source: DocumentNamingSegmentSourceT
  value?: string | null
  fieldKey?: string | null
  padChar?: string | null
}

export type DocumentNamingConfigT = {
  id?: string
  fondId: string
  targetType: DocumentNamingTargetTypeT
  dossierId?: string | null
  segments: Array<DocumentNamingSegmentT>
  autoIncrementCounter?: number
  createdAt?: string
  updatedAt?: string
}

export type DocumentNamingFieldOptionT = {
  key: string
  label: string
}

export type DocumentNamingFieldCatalogT = {
  fond: Array<DocumentNamingFieldOptionT>
  dossier: Array<DocumentNamingFieldOptionT>
  file: Array<DocumentNamingFieldOptionT>
}

export type DocumentNamingDossierOptionT = {
  id: string
  name: string
  folderPath: string
}

export type UpsertDocumentNamingConfigPayloadT = {
  fondId: string
  targetType: DocumentNamingTargetTypeT
  dossierId?: string | null
  segments: Array<DocumentNamingSegmentT>
}

export type DocumentNamingPreviewPayloadT = UpsertDocumentNamingConfigPayloadT

export type DocumentNamingPreviewResponseT = {
  previews: Array<string>
}
