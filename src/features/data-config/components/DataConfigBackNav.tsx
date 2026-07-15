import { useTranslation } from 'react-i18next'

import { SectionBackNav } from '@/features/navigation/components/SectionBackNav'

export function DataConfigBackNav({
  currentLabel,
  description,
}: {
  currentLabel: string
  description?: string
}) {
  const { t } = useTranslation('data-config')

  return (
    <SectionBackNav
      to="/app/data-config"
      currentLabel={currentLabel}
      description={description}
      backAriaLabel={`${t('hub.back')}: ${t('title')}`}
    />
  )
}
