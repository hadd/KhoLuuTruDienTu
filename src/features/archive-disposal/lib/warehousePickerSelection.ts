export function shouldShowWarehousePickerSelection(input: {
  pickerMode: boolean
  canUpdateDisposal: boolean
  disposalCatalogId?: string | null
  isEsSearchActive: boolean
}): boolean {
  return (
    input.pickerMode &&
    input.canUpdateDisposal &&
    Boolean(input.disposalCatalogId) &&
    !input.isEsSearchActive
  )
}

export function shouldShowWarehouseRowSelection(input: {
  showDownload: boolean
  showPickerSelection: boolean
}): boolean {
  return input.showDownload || input.showPickerSelection
}
