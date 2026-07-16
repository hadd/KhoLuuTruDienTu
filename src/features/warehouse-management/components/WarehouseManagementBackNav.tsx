import { useTranslation } from 'react-i18next'

import {
  SectionBackNav,
  sectionUnderlineTabsListClassName,
  sectionUnderlineTabsTriggerClassName,
  sectionUnderlineTabsTriggerCompactClassName,
} from '@/features/navigation/components/SectionBackNav'

export function WarehouseManagementBackNav({
  currentLabel,
  description,
}: {
  currentLabel: string
  description?: string
}) {
  const { t } = useTranslation('warehouse-management')

  return (
    <SectionBackNav
      to="/app/warehouse-management"
      currentLabel={currentLabel}
      description={description}
      backAriaLabel={`${t('breadcrumb.back')}: ${t('title')}`}
    />
  )
}

export const warehouseUnderlineTabsListClassName =
  sectionUnderlineTabsListClassName
export const warehouseUnderlineTabsTriggerClassName =
  sectionUnderlineTabsTriggerClassName
export const warehouseUnderlineTabsTriggerCompactClassName =
  sectionUnderlineTabsTriggerCompactClassName
