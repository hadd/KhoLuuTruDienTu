export function shouldShowWarehousePickerSelection(input: {
  pickerMode: boolean
  councilReviewEnabled: boolean
  canUpdateDisposal: boolean
  disposalCatalogId?: string | null
  isEsSearchActive: boolean
}): boolean {
  return (
    input.pickerMode &&
    input.councilReviewEnabled &&
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

export function buildWarehousePickerRouteSearch(input: {
  pickerMode?: boolean
  disposalCatalogId?: string | null
  page?: number
}): {
  pickerMode?: true
  disposalCatalogId?: string
  page?: number
} {
  if (!input.pickerMode) {
    return input.page != null ? { page: input.page } : {}
  }

  return {
    pickerMode: true,
    ...(input.disposalCatalogId ? { disposalCatalogId: input.disposalCatalogId } : {}),
    ...(input.page != null ? { page: input.page } : {}),
  }
}
