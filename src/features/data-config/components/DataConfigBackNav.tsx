import { SectionPageHeader } from '@/features/navigation/components/SectionBackNav'

export function DataConfigBackNav({
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
