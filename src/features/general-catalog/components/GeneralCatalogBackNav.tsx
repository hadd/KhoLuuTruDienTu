import { SectionPageHeader } from '@/features/navigation/components/SectionBackNav'

export function GeneralCatalogBackNav({
  currentLabel,
  description,
}: {
  currentLabel: string
  description?: string
}) {
  return (
    <SectionPageHeader currentLabel={currentLabel} description={description} />
  )
}
