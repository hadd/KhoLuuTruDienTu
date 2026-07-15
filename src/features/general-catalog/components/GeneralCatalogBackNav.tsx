import { useTranslation } from 'react-i18next'

import { SectionBackNav } from '@/features/navigation/components/SectionBackNav'

export function GeneralCatalogBackNav({
  currentLabel,
  description,
}: {
  currentLabel: string
  description?: string
}) {
  const { t } = useTranslation('general-catalog')

  return (
    <SectionBackNav
      to="/app/general-catalog"
      currentLabel={currentLabel}
      description={description}
      backAriaLabel={`${t('breadcrumb.back')}: ${t('title')}`}
    />
  )
}
